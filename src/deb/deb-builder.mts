import { createGzip } from 'zlib';

import * as crypto from 'crypto';
import * as fs from 'fs';
import * as ini from 'ini';
import * as os from 'os';
import * as path from 'path';
import * as tar from 'tar';

import type { Artifact, ArtifactsProvider } from '../artifacts-provider.mjs';
import { createDir, execToolToFile, removeDir } from '../fs.mjs';
import type { Config } from '../config.mjs';
import type { IBuilder } from '../ibuilder.mjs';
import type { Packages } from '../repo.mjs';
import { requestRange } from '../http.mjs';

const ReleaseFileTemplate =
`Origin: $ORIGIN
Label: Ubuntu/Debian
Architecture: $ARCH
Component: $COMPONENT
Codename: $CHANNEL\n`;

interface DebDescriptor {
	version: string,
	url: string,
	artifact: Artifact
}

export class DebBuilder implements IBuilder {
	private readonly config: Config;
	private readonly artifactsProvider: ArtifactsProvider;

	private readonly pool: string;
	private readonly dists: string;
	private readonly keys: string;

	private debRepo: {
		channel: string,
		debs: DebDescriptor[]
	}[] = [];

	private archesByChannel: Map<string, Set<string>> = new Map();

	constructor(artifactsProvider: ArtifactsProvider, config: Config) {
		this.config = config;

		this.pool = `${this.config.base.out}/repo/${this.config.debBuilder.applicationName}/deb/pool`;
		this.dists = `${this.config.base.out}/repo/${this.config.debBuilder.applicationName}/deb/dists`;
		this.keys = `${this.config.base.out}/repo/${this.config.debBuilder.applicationName}/deb/keys`;
		this.artifactsProvider = artifactsProvider;
	}

	public async plan(): Promise<void> {
		await this.prepareMetaRepository();
		await this.dpkgScanpackages();
		await this.makeRelease();
	}

	public apply(): void {
		console.log(this);
	}

	private debName(version: string, arch: string): string {
		return `${this.config.debBuilder.applicationName}-${version}_${arch}.deb`;
	}

	private async makeReleaseFileAndSign(channel: string, arch: string): Promise<void> {
		const publicKeyPath = path.join(this.keys, 'desktop.asc');
		createDir(this.keys);
		await fs.promises.copyFile(this.config.debBuilder.gpgPublicKeyPath, publicKeyPath);

		const releaseContent = ReleaseFileTemplate
			.replace('$ORIGIN', this.config.debBuilder.origin)
			.replace('$CHANNEL', channel)
			.replace('$ARCH', arch)
			.replace('$COMPONENT', this.config.debBuilder.component);

		const releaseFilePath = path.join(this.dists, channel, 'Release');
		const releaseGpgFilePath = path.join(this.dists, channel, 'Release.gpg');
		const inReleaseFilePath = path.join(this.dists, channel, 'InRelease');

		await fs.promises.writeFile(releaseFilePath, releaseContent);
		await fs.promises.copyFile(releaseFilePath, inReleaseFilePath);

		await execToolToFile('apt-ftparchive', ['release', `${this.dists}/${channel}`], releaseFilePath, true);
		await execToolToFile('gpg', ['--default-key', this.config.debBuilder.gpgKeyName, '-abs', '-o', releaseGpgFilePath, releaseFilePath]);
		await execToolToFile('gpg', ['--default-key', this.config.debBuilder.gpgKeyName, '--clearsign', '-o', inReleaseFilePath, releaseFilePath]);
	}

	private async prepareMetaRepository(): Promise<void> {
		const debsPromises: Promise<{channel: string, debs: DebDescriptor[]}>[] = [];

		this.config.base.repo.forEach(channelEntry => {
			debsPromises.push((async(): Promise<{ channel: string, debs: DebDescriptor[] }> => ({
				channel: channelEntry.channel,
				debs: await this.debsByPackages(channelEntry.packages),
			}))());
		});

		const debs = await Promise.all(debsPromises);

		debs.forEach(entry => {
			this.debRepo.push(entry);
		});
	}

	private async debsByPackages(packs: Packages): Promise<DebDescriptor[]> {
		const debsPromises: Promise<DebDescriptor>[] = [];
		const artsByBuildNumbersPromises: Promise<{version: string, artifacts: Artifact[]}>[] = [];

		packs.packages.forEach(pack => {
			artsByBuildNumbersPromises.push((async(): Promise<{ version: string, artifacts: Artifact[] }> => ({
				version: pack.version,
				artifacts: await this.artifactsProvider.artifactsByBuildNumber(pack.buildNumber),
			}))());
		});

		const artsByBuildNumbers = await Promise.all(artsByBuildNumbersPromises);

		artsByBuildNumbers.forEach(value => {
			value.artifacts.filter(artifact => artifact.type === 'deb').forEach(artifact => {
				debsPromises.push((async(): Promise<DebDescriptor> => ({
					version: value.version,
					artifact,
					url: await this.artifactsProvider.artifactUrl(artifact),
				}))());
			});
		});

		return Promise.all(debsPromises);
	}

	private async dpkgScanpackages(): Promise<void> {
		const promises: Promise<void>[] = [];

		this.debRepo.forEach(channel => {
			channel.debs.forEach(deb => {
				promises.push(this.handleDeb(channel.channel, deb));
			});
		});

		await Promise.all(promises);
	}

	private async handleDeb(channel: string, deb: DebDescriptor): Promise<void> {
		const debUrl = deb.url;
		const controlTarSizeRange = '120-129';

		// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
		const cocntrolTarSize = Number((await requestRange(debUrl, controlTarSizeRange)).read().toString()
			.trim());
		const controlTarRange = `132-${131 + cocntrolTarSize}`;
		const controlTar = await requestRange(debUrl, controlTarRange);

		const whereExtract = path.join(os.tmpdir(), `control-${crypto.randomBytes(4).toString('hex')}`);

		createDir(whereExtract);

		await new Promise<void>(resolve => {
			controlTar
				.pipe(tar.extract({ cwd: whereExtract, strip: 1 }, ['./control']))
				// eslint-disable-next-line max-statements
				.on('finish', () => {
					const controlMetaContent = fs.readFileSync(path.join(whereExtract, 'control'), 'utf-8').replaceAll(':', '=');
					const controlMeta = ini.parse(controlMetaContent);
					const arch = controlMeta['Architecture'];

					const archesSet = this.archesByChannel.get(channel);

					if (archesSet) {
						archesSet.add(arch);
					} else {
						this.archesByChannel.set(channel, new Set<string>([arch]));
					}

					const targetMetaPath = path.join(this.dists,
						channel,
						this.config.debBuilder.component,
						`binary-${arch}`,
						`${this.debName(deb.version, arch)}.meta`);
					createDir(path.dirname(targetMetaPath));
					fs.renameSync(path.join(whereExtract, 'control'), targetMetaPath);

					removeDir(whereExtract);

					const debPath = path.join(this.pool,
						this.config.debBuilder.component,
						`${this.config.debBuilder.applicationName[0]}`,
						this.config.debBuilder.applicationName,
						channel,
						this.debName(deb.version, arch));
					const repoRoot = path.join(this.config.base.out, 'repo', this.config.debBuilder.applicationName, 'deb');
					const relativeDebPath = path.relative(repoRoot, debPath);
					this.artifactsProvider.createMetapointerFile(deb.artifact, debPath);
					const debSize = controlTar.headers['content-range']?.split('/')[1];
					const sha1 = controlTar.headers['x-checksum-sha1'];
					const sha256 = controlTar.headers['x-checksum-sha256'];
					const md5 = controlTar.headers['x-checksum-md5'];

					if (typeof sha1 !== 'string' || typeof sha256 !== 'string' || typeof md5 !== 'string' || typeof debSize !== 'string') {
						throw new Error('No checksum was found in headers');
					}

					const dataToAppend = `Filename: ${relativeDebPath}\nSize: ${debSize}\nSHA1: ${sha1}\nSHA256: ${sha256}\nMD5Sum: ${md5}\n`;

					fs.appendFile(targetMetaPath, dataToAppend, err => {
						if (err) {
							throw err;
						}

						resolve();
					});
				});
		});
	}

	private async makeRelease(): Promise<{}> {
		const compressFile = (filePath: string): Promise<void> => new Promise<void>(resolve => {
			const inp = fs.createReadStream(filePath);
			const out = fs.createWriteStream(`${filePath}.gz`);

			const gzip = createGzip({ level: 9 });

			inp.pipe(gzip).pipe(out)
				.on('finish', () => {
					resolve();
				});
		});

		const compressPromises: Promise<void>[] = [];

		this.debRepo.forEach(channelEntry => {
			const distsRoot = path.join(this.dists, channelEntry.channel, this.config.debBuilder.component);
			const distsByArch = fs.readdirSync(distsRoot).map(dist => path.join(distsRoot, dist));

			distsByArch.forEach(dist => {
				const targetPackagesFile = path.join(dist, 'Packages');
				const metaFiles = fs.readdirSync(dist)
					.filter(fileName => fileName.endsWith('.meta'))
					.map(metaFile => path.join(dist, metaFile));

				let packagesContent = '';

				for (const metaFile of metaFiles) {
					packagesContent += fs.readFileSync(metaFile);
					packagesContent += '\n';
					fs.unlinkSync(metaFile);
				}

				fs.writeFileSync(targetPackagesFile, packagesContent);

				compressPromises.push(compressFile(targetPackagesFile));
			});
		});

		await Promise.all(compressPromises);

		const releasesPromises: Promise<void>[] = [];

		this.debRepo.forEach(chan => {
			const archesSet = this.archesByChannel.get(chan.channel);
			if (!archesSet) {
				throw new Error('No arch was found for channel');
			}

			releasesPromises.push(this.makeReleaseFileAndSign(chan.channel, [...archesSet.values()].join(' ')));
		});

		return Promise.all(releasesPromises);
	}
}
