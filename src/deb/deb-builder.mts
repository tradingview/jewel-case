import { createGzip } from 'zlib';
import { spawnSync } from 'child_process';

import * as crypto from 'crypto';
import * as fs from 'fs';
import * as ini from 'ini';
import * as os from 'os';
import * as path from 'path';
import * as tar from 'tar';

import type { Artifact, ArtifactsProvider } from '../artifacts-provider.mjs';
import { createDir, removeDir } from '../fs.mjs';
import type { Config } from '../config.mjs';
import type { IBuilder } from '../ibuilder.mjs';
import { requestRange } from '../http.mjs';

const ReleaseFileTemplate =
`Origin: $ORIGIN
Label: Ubuntu/Debian
Architecture: $ARCH
Component: $COMPONENT
Codename: $CHANNEL\n`;


export class DebBuilder implements IBuilder {
	private readonly config: Config;
	private readonly artifactsProvider: ArtifactsProvider;

	private readonly pool: string;
	private readonly dists: string;
	private readonly keys: string;

	private debRepo: {
		channel: string,
		debs: {
			version: string,
			url: string,
			artifact: Artifact
		}[]}[] = [];

	constructor(artifactsProvider: ArtifactsProvider, config: Config) {
		this.config = config;

		this.pool = `${this.config.base.out}/repo/${this.config.debBuilder.applicationName}/deb/pool`;
		this.dists = `${this.config.base.out}/repo/${this.config.debBuilder.applicationName}/deb/dists`;
		this.keys = `${this.config.base.out}/repo/${this.config.debBuilder.applicationName}/deb/keys`;
		this.artifactsProvider = artifactsProvider;
	}

	public async plan(): Promise<void> {
		for (const entry of this.config.base.repo) {
			const debs: {
				version: string,
				url: string,
				artifact: Artifact
			}[] = [];

			for (const pack of entry.packages.packages) {
				const debArtifactItems = (await this.artifactsProvider.artifactsByBuildNumber(pack.buildNumber)).filter(artifact => artifact.type === 'deb');

				for (const artifact of debArtifactItems) {
					debs.push({
						version: pack.version,
						url: await this.artifactsProvider.artifactUrl(artifact),
						artifact,
					});
				}
			}

			this.debRepo.push({ channel: entry.channel, debs });
		}


		for (const channel of this.debRepo) {
			for (const deb of channel.debs) {
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
						.on('finish', () => {
							const controlMetaContent = fs.readFileSync(path.join(whereExtract, 'control'), 'utf-8').replaceAll(':', '=');
							const controlMeta = ini.parse(controlMetaContent);

							const targetMetaPath = path.join(this.dists, channel.channel, this.config.debBuilder.component, `binary-${controlMeta['Architecture']}`, `${this.debName(deb.version, controlMeta['Architecture'])}.meta`);
							createDir(path.dirname(targetMetaPath));
							fs.renameSync(path.join(whereExtract, 'control'), targetMetaPath);

							removeDir(whereExtract);

							const debPath = path.join(this.pool, this.config.debBuilder.component, `${this.config.debBuilder.applicationName[0]}`, this.config.debBuilder.applicationName, channel.channel, this.debName(deb.version, controlMeta['Architecture']));
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
		}

		const compressFile = (input: string): Promise<void> => new Promise<void>(resolve => {
			const inp = fs.createReadStream(input);
			const out = fs.createWriteStream(`${input}.gz`);

			const gzip = createGzip({ level: 9 });

			inp.pipe(gzip).pipe(out)
				.on('finish', () => {
					resolve();
				});
		});

		for (const chan of this.debRepo) {
			const distsRoot = path.join(this.dists, chan.channel, this.config.debBuilder.component);
			const distsByArch = fs.readdirSync(distsRoot).map(dist => path.join(distsRoot, dist));

			for (const dist of distsByArch) {
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

				await compressFile(targetPackagesFile);
			}

			await this.makeRelease(chan.channel, 'amd64');
		}
	}

	public apply(): void {
		console.log(this);
	}

	private debName(version: string, arch: string): string {
		return `${this.config.debBuilder.applicationName}-${version}_${arch}.deb`;
	}

	private async makeRelease(channel: string, arch: string): Promise<void> {
		console.log('DebBuilder: makeRelease');

		const publicKeyPath = path.join(this.keys, 'desktop.asc');
		createDir(this.keys);
		await fs.promises.copyFile(this.config.debBuilder.gpgPublicKeyPath, publicKeyPath);

		const releaseContent = ReleaseFileTemplate
			.replace('$ORIGIN', this.config.debBuilder.origin)
			.replace('$CHANNEL', channel)
			.replace('$ARCH', arch)
			.replace('$COMPONENT', this.config.debBuilder.component);

		const releasePath = path.join(this.dists, channel, 'main', `binary-${arch}`, 'Release');
		const releaseFilePath = path.join(this.dists, channel, 'Release');
		const releaseGpgFilePath = path.join(this.dists, channel, 'Release.gpg');
		const inReleaseFilePath = path.join(this.dists, channel, 'InRelease');

		await fs.promises.writeFile(releasePath, releaseContent);
		await fs.promises.copyFile(releasePath, releaseFilePath);

		await this.execToolToFile('apt-ftparchive', ['release', `${this.dists}/${channel}`], releaseFilePath, true);
		await this.execToolToFile('gpg', ['--default-key', this.config.debBuilder.gpgKeyName, '-abs', '-o', releaseGpgFilePath, releaseFilePath]);
		await this.execToolToFile('gpg', ['--default-key', this.config.debBuilder.gpgKeyName, '--clearsign', '-o', inReleaseFilePath, releaseFilePath]);
	}

	private async execToolToFile(tool: string, args: string[], outputPath?: string, append?: boolean): Promise<void> {
		if (!append && outputPath && fs.existsSync(outputPath)) {
			await fs.promises.unlink(outputPath);
		}

		const toolProcessResult = spawnSync(tool, args, { stdio: 'pipe', encoding: 'utf-8' });
		const toolOutput = toolProcessResult.stdout;

		const dumpToolOutput = (): void => {
			const toolErrOutput = toolProcessResult.stderr;
			if (toolOutput && toolOutput.length > 0) {
				console.log(toolOutput);
			}

			if (toolErrOutput && toolErrOutput.length > 0) {
				console.warn(toolErrOutput);
			}
		};

		if (outputPath) {
			console.log(`Execute ${tool} ${args.join(' ')} => ${outputPath}`);
			dumpToolOutput();
			if (append) {
				return fs.promises.appendFile(outputPath, toolOutput);
			}

			return fs.promises.writeFile(outputPath, toolOutput);
		}

		console.log(`Execute ${tool} ${args.join(' ')}`);
		dumpToolOutput();
	}
}
