import { createGzip } from 'zlib';

import * as fs from 'fs';
import * as ini from 'ini';
import * as path from 'path';
import * as tar from 'tar';

import type { Artifact, ArtifactProvider } from '../artifact-provider.mjs';
import { createDir, execToolToFile, removeDir } from '../fs.mjs';
import type { Deployer } from '../deployer.mjs';

type DebRepoDistribution = string;
type DebRepoComponent = string;

export interface DebRepo {
	[key: DebRepoDistribution]: {
		[key: DebRepoComponent]: Artifact[]
	}
}

const ReleaseFileTemplate =
`Origin: $ORIGIN
Label: Ubuntu/Debian
Architecture: $ARCH
Component: $COMPONENT
Codename: $DISTRIBUTION\n`;

function iterateComponents(repo: DebRepo, callback: (distribution: string, component: string, deb: Artifact[]) => void): void {
	const distributions = Object.keys(repo);

	distributions.forEach(distribution => {
		const componentsFordistribution = repo[distribution];
		if (componentsFordistribution) {
			Object.entries(componentsFordistribution).forEach(entry => {
				const [component, debs] = entry;
				callback(distribution, component, debs);
			});
		}
	});
}

function iterateDebs(repo: DebRepo, callback: (distribution: string, component: string, deb: Artifact) => void): void {
	iterateComponents(repo, (distribution: string, component: string, debs: Artifact[]) => {
		debs.forEach(deb => {
			callback(distribution, component, deb);
		});
	});
}

export interface Config {
	out: string,
	gpgKeyName: string;
	applicationName: string;
	origin: string;
	repo: DebRepo;
}

export class DebBuilder implements Deployer {
	private readonly config: Config;
	private readonly artifactProvider: ArtifactProvider;
	private readonly packageCreator: (md5: string, path: string) => (Promise<void> | void);

	private readonly rootPath: string;
	private readonly tempPath: string;
	private readonly poolPath: string;
	private readonly distsPath: string;
	private archesByDistComp: Map<string, Set<string>> = new Map();

	constructor(config: Config, artifactProvider: ArtifactProvider, packageCreator: (md5: string, path: string) => (Promise<void> | void)) {
		this.config = config;
		this.artifactProvider = artifactProvider;
		this.packageCreator = packageCreator;

		this.rootPath = path.join(this.config.out);
		this.tempPath = path.join(this.config.out, 'temp');
		this.poolPath = path.join(this.rootPath, 'pool');
		this.distsPath = path.join(this.rootPath, 'dists');
	}

	public async plan(): Promise<void> {
		try {
			await this.dpkgScanpackages();
			await this.makeRelease();
		} finally {
			removeDir(this.tempPath);
		}
	}

	public apply(): void {
		console.log(this);
	}

	private debFileName(version: string, arch: string): string {
		return `${this.config.applicationName}-${version}_${arch}.deb`;
	}

	private async makeReleaseFileAndSign(distribution: string, component: string, arch: string): Promise<void> {
		const releaseContent = ReleaseFileTemplate
			.replace('$ORIGIN', this.config.origin)
			.replace('$DISTRIBUTION', distribution)
			.replace('$ARCH', arch)
			.replace('$COMPONENT', component);

		const distributionPath = path.join(this.distsPath, distribution);
		const releaseFilePath = path.join(distributionPath, 'Release');
		const releaseGpgFilePath = path.join(distributionPath, 'Release.gpg');
		const inReleaseFilePath = path.join(distributionPath, 'InRelease');

		await fs.promises.writeFile(releaseFilePath, releaseContent);

		await execToolToFile('apt-ftparchive', ['release', distributionPath], releaseFilePath, true);
		await execToolToFile('gpg', ['--no-tty', '--default-key', this.config.gpgKeyName, '-abs', '-o', releaseGpgFilePath, releaseFilePath]);
		await execToolToFile('gpg', ['--no-tty', '--default-key', this.config.gpgKeyName, '--clearsign', '-o', inReleaseFilePath, releaseFilePath]);
	}

	private async dpkgScanpackages(): Promise<void> {
		const promises: Promise<void>[] = [];

		iterateDebs(this.config.repo, (distribution, component, deb) => {
			promises.push(this.handleDeb(distribution, component, deb));
		});

		await Promise.all(promises);
	}

	private async handleDeb(distribution: string, component: string, deb: Artifact): Promise<void> {
		const controlTarSizeRange = { start: 120, end: 129 };
		const controlTarSizeString =
			(await this.artifactProvider.getArtifactContent(deb, controlTarSizeRange))
				.read()
				.toString()
				.trim();
		const controlTarSize = parseInt(controlTarSizeString, 10);
		const controlTarRange = { start: 132, end: 131 + controlTarSize };
		const controlTar = await this.artifactProvider.getArtifactContent(deb, controlTarRange);

		const whereExtract = path.join(this.tempPath, `control-${deb.md5}`);
		createDir(whereExtract);

		let createFilePromise: Promise<void> | undefined = undefined;

		await new Promise<void>(resolve => {
			controlTar
				.pipe(tar.extract({ cwd: whereExtract, strip: 1 }, ['./control']))
				// eslint-disable-next-line max-statements
				.on('finish', () => {
					const controlMetaContent = fs.readFileSync(path.join(whereExtract, 'control'), 'utf-8').replaceAll(':', '=');
					const controlMeta = ini.parse(controlMetaContent);
					const arch = controlMeta['Architecture'];
					const version = controlMeta['Version'];

					const archesSet = this.archesByDistComp.get(`${distribution}/${component}`);

					if (archesSet) {
						archesSet.add(arch);
					} else {
						this.archesByDistComp.set(`${distribution}/${component}`, new Set<string>([arch]));
					}

					const targetMetaPath = path.join(this.distsPath,
						distribution,
						component,
						`binary-${arch}`,
						`${this.debFileName(version, arch)}.meta`);
					createDir(path.dirname(targetMetaPath));
					fs.renameSync(path.join(whereExtract, 'control'), targetMetaPath);

					removeDir(whereExtract);

					const debPath = path.join(this.poolPath,
						component,
						`${this.config.applicationName[0]}`,
						this.config.applicationName,
						distribution,
						this.debFileName(version, arch));
					const relativeDebPath = path.relative(this.rootPath, debPath);
					const debSize = controlTar.headers['content-range']?.split('/')[1];
					const sha1 = controlTar.headers['x-checksum-sha1'];
					const sha256 = controlTar.headers['x-checksum-sha256'];
					const md5 = controlTar.headers['x-checksum-md5'];

					if (typeof sha1 !== 'string' || typeof sha256 !== 'string' || typeof md5 !== 'string' || typeof debSize !== 'string') {
						throw new Error('No checksum was found in headers');
					}

					const dataToAppend = `Filename: ${relativeDebPath}\nSize: ${debSize}\nSHA1: ${sha1}\nSHA256: ${sha256}\nMD5Sum: ${md5}\n`;

					fs.promises.appendFile(targetMetaPath, dataToAppend).then(() => resolve());

					const createFileOperation = this.packageCreator(deb.md5, debPath);

					if (createFileOperation instanceof Promise) {
						createFilePromise = createFileOperation;
					}
				});
		});

		if (createFilePromise) {
			await createFilePromise;
		}
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

		iterateComponents(this.config.repo, (distribution, component) => {
			const componentRoot = path.join(this.distsPath, distribution, component);
			const componentsByArch = fs.readdirSync(componentRoot).map(dist => path.join(componentRoot, dist));

			componentsByArch.forEach(dist => {
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

		iterateComponents(this.config.repo, (distribution, component) => {
			const archesSet = this.archesByDistComp.get(`${distribution}/${component}`);
			if (!archesSet) {
				throw new Error('No arch was found for distribution');
			}

			releasesPromises.push(this.makeReleaseFileAndSign(distribution, component, [...archesSet.values()].join(' ')));
		});

		return Promise.all(releasesPromises);
	}
}
