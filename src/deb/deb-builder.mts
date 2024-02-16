import { createGzip } from 'zlib';

import * as fs from 'fs';
import * as ini from 'ini';
import * as path from 'path';
import * as tar from 'tar';

import type { Artifact, ArtifactProvider } from '../artifact-provider.mjs';
import { createDir, execToolToFile, removeDir } from '../fs.mjs';
import type { Config } from '../config.mjs';
import type { Deployer } from '../deployer.mjs';
import type { Packages } from '../repo.mjs';

const ReleaseFileTemplate =
`Origin: $ORIGIN
Label: Ubuntu/Debian
Architecture: $ARCH
Component: $COMPONENT
Codename: $DISTRIBUTION\n`;

interface DebDescriptor {
	version: string,
	artifact: Artifact
}

interface DistributionItem {
	distribution: string;
	debs: DebDescriptor[]
}

export class DebBuilder implements Deployer {
	private readonly config: Config;
	private readonly artifactProvider: ArtifactProvider;

	private readonly root: string;
	private readonly temp: string;
	private readonly pool: string;
	private readonly dists: string;
	private readonly keys: string;

	private debRepo: DistributionItem[] = [];

	private archesByDistribution: Map<string, Set<string>> = new Map();

	constructor(artifactProvider: ArtifactProvider, config: Config) {
		this.config = config;

		this.root = path.join(this.config.base.out, 'repo', this.config.debBuilder.applicationName, 'deb');
		this.temp = path.join(this.config.base.out, 'temp');
		this.pool = path.join(this.root, 'pool');
		this.dists = path.join(this.root, 'dists');
		this.keys = path.join(this.root, 'keys');
		this.artifactProvider = artifactProvider;
	}

	public async plan(): Promise<void> {
		try {
			await this.prepareMetaRepository();
			await this.dpkgScanpackages();
			await this.makeRelease();
		} finally {
			removeDir(this.temp);
		}
	}

	public apply(): void {
		console.log(this);
	}

	private debName(version: string, arch: string): string {
		return `${this.config.debBuilder.applicationName}-${version}_${arch}.deb`;
	}

	private async makeReleaseFileAndSign(distribution: string, arch: string): Promise<void> {
		const publicKeyPath = path.join(this.keys, 'desktop.asc');
		createDir(this.keys);
		await fs.promises.copyFile(this.config.debBuilder.gpgPublicKeyPath, publicKeyPath);

		const releaseContent = ReleaseFileTemplate
			.replace('$ORIGIN', this.config.debBuilder.origin)
			.replace('$DISTRIBUTION', distribution)
			.replace('$ARCH', arch)
			.replace('$COMPONENT', this.config.debBuilder.component);

		const releaseFilePath = path.join(this.dists, distribution, 'Release');
		const releaseGpgFilePath = path.join(this.dists, distribution, 'Release.gpg');
		const inReleaseFilePath = path.join(this.dists, distribution, 'InRelease');

		await fs.promises.writeFile(releaseFilePath, releaseContent);

		await execToolToFile('apt-ftparchive', ['release', `${this.dists}/${distribution}`], releaseFilePath, true);
		await execToolToFile('gpg', ['--no-tty', '--default-key', this.config.debBuilder.gpgKeyName, '-abs', '-o', releaseGpgFilePath, releaseFilePath]);
		await execToolToFile('gpg', ['--no-tty', '--default-key', this.config.debBuilder.gpgKeyName, '--clearsign', '-o', inReleaseFilePath, releaseFilePath]);
	}

	private async prepareMetaRepository(): Promise<void> {
		const debsPromises: Promise<{distribution: string, debs: DebDescriptor[]}>[] = [];

		this.config.base.repo.forEach(distributionEntry => {
			debsPromises.push((async(): Promise<{ distribution: string, debs: DebDescriptor[] }> => ({
				distribution: distributionEntry.channel,
				debs: await this.debsByPackages(distributionEntry.packages),
			}))());
		});

		const debs = await Promise.all(debsPromises);

		debs.forEach(entry => {
			this.debRepo.push(entry);
		});
	}

	private async debsByPackages(packs: Packages): Promise<DebDescriptor[]> {
		const debs: DebDescriptor[] = [];
		const artsByBuildNumbersPromises: Promise<{version: string, artifacts: Artifact[]}>[] = [];

		packs.packages.forEach(pack => {
			artsByBuildNumbersPromises.push((async(): Promise<{ version: string, artifacts: Artifact[] }> => ({
				version: pack.version,
				artifacts: await this.artifactProvider.artifactsByBuildNumber(pack.buildNumber),
			}))());
		});

		const artsByBuildNumbers = await Promise.all(artsByBuildNumbersPromises);

		artsByBuildNumbers.forEach(value => {
			value.artifacts.filter(artifact => artifact.type === 'deb').forEach(artifact => {
				debs.push({
					version: value.version,
					artifact,
				});
			});
		});

		return debs;
	}

	private async dpkgScanpackages(): Promise<void> {
		const promises: Promise<void>[] = [];

		this.debRepo.forEach(distribution => {
			distribution.debs.forEach(deb => {
				promises.push(this.handleDeb(distribution.distribution, deb));
			});
		});

		await Promise.all(promises);
	}

	private async handleDeb(distribution: string, deb: DebDescriptor): Promise<void> {
		const controlTarSizeRange = { start: 120, end: 129 };

		// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
		const controlTarSize = Number((await this.artifactProvider.getArtifactContent(deb.artifact, controlTarSizeRange)).read().toString()
			.trim());
		const controlTarRange = { start: 132, end: 131 + controlTarSize };

		const controlTar = await this.artifactProvider.getArtifactContent(deb.artifact, controlTarRange);

		const whereExtract = path.join(this.temp, `control-${deb.artifact.md5}`);

		createDir(whereExtract);

		await new Promise<void>(resolve => {
			controlTar
				.pipe(tar.extract({ cwd: whereExtract, strip: 1 }, ['./control']))
				// eslint-disable-next-line max-statements
				.on('finish', () => {
					const controlMetaContent = fs.readFileSync(path.join(whereExtract, 'control'), 'utf-8').replaceAll(':', '=');
					const controlMeta = ini.parse(controlMetaContent);
					const arch = controlMeta['Architecture'];

					const archesSet = this.archesByDistribution.get(distribution);

					if (archesSet) {
						archesSet.add(arch);
					} else {
						this.archesByDistribution.set(distribution, new Set<string>([arch]));
					}

					const targetMetaPath = path.join(this.dists,
						distribution,
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
						distribution,
						this.debName(deb.version, arch));
					const relativeDebPath = path.relative(this.root, debPath);
					this.artifactProvider.createMetapointerFile(deb.artifact, debPath);
					const debSize = controlTar.headers['content-range']?.split('/')[1];
					const sha1 = controlTar.headers['x-checksum-sha1'];
					const sha256 = controlTar.headers['x-checksum-sha256'];
					const md5 = controlTar.headers['x-checksum-md5'];

					if (typeof sha1 !== 'string' || typeof sha256 !== 'string' || typeof md5 !== 'string' || typeof debSize !== 'string') {
						throw new Error('No checksum was found in headers');
					}

					const dataToAppend = `Filename: ${relativeDebPath}\nSize: ${debSize}\nSHA1: ${sha1}\nSHA256: ${sha256}\nMD5Sum: ${md5}\n`;

					fs.promises.appendFile(targetMetaPath, dataToAppend).then(() => resolve());
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

		this.debRepo.forEach(distributionEntry => {
			const distsRoot = path.join(this.dists, distributionEntry.distribution, this.config.debBuilder.component);
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
			const archesSet = this.archesByDistribution.get(chan.distribution);
			if (!archesSet) {
				throw new Error('No arch was found for distribution');
			}

			releasesPromises.push(this.makeReleaseFileAndSign(chan.distribution, [...archesSet.values()].join(' ')));
		});

		return Promise.all(releasesPromises);
	}
}
