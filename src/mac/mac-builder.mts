import * as fs from 'fs';
import * as path from 'path';

import type { Artifact, ArtifactProvider } from '../artifact-provider.mjs';
import type { Deployer } from '../deployer.mjs';

type Channel = string;

export interface PackageDescriptor {
	version: string,
	dmg: Artifact,
	zip: Artifact,
	sha512: Artifact
}

export interface MacRepo {
	[key: Channel]: {
		latest: string,
		additionalFiles?: string[],
		packages: PackageDescriptor[]
	}
}

export interface Config {
	out: string,
	repo: MacRepo
}

function interateChannels(repo: MacRepo, callback: (channel: string, channelObj: {
		latest: string,
		additionalFiles?: string[],
		packages: PackageDescriptor[]}) => void): void {
	const channels = Object.keys(repo);

	channels.forEach(channel => {
		const channelObject = repo[channel];
		if (channelObject) {
			callback(channel, channelObject);
		}
	});
}

const YmlContentTemplate =
`version: $VERSION
path: $PATH
sha512: $SHA512
releaseDate: '$DATE'`;

function iteratePackages(repo: MacRepo, callback: (channel: string, pack: PackageDescriptor) => void): void {
	const channels = Object.keys(repo);

	channels.forEach(channel => {
		const channelObject = repo[channel];
		if (channelObject) {
			const packs = channelObject.packages;
			packs.forEach(pack => {
				callback(channel, pack);
			});
		}
	});
}

export class MacBuilder implements Deployer {
	private readonly config: Config;
	private readonly artifactProvider: ArtifactProvider;
	private readonly packageCreator: (md5: string, path: string) => (Promise<void> | void);
	private readonly releaseDate: string;

	constructor(config: Config, artifactProvider: ArtifactProvider, packageCreator: (md5: string, path: string) => (Promise<void> | void)) {
		this.config = config;
		this.artifactProvider = artifactProvider;
		this.packageCreator = packageCreator;

		this.releaseDate = new Date().toISOString();
	}

	public async plan(): Promise<void> {
		await this.makePackages();
		await this.makeRelease();
	}

	public apply(): void {
		console.log(this);
	}

	private async makePackages(): Promise<void> {
		const promises: Promise<void>[] = [];

		iteratePackages(this.config.repo, (channel: string, packs: PackageDescriptor) => {
			promises.push(this.handlePackage(channel, packs));
		});

		await Promise.all(promises);
	}

	private async makeRelease(): Promise<void> {
		const promises: Promise<void>[] = [];

		interateChannels(this.config.repo, (channel: string, channelObj: { latest: string, packages: PackageDescriptor[]}) => {
			promises.push(this.handleLatest(channel, channelObj));
		});

		await Promise.all(promises);
	}

	private async handlePackage(channel: string, pack: PackageDescriptor): Promise<void> {
		const promises: Promise<void>[] = [];

		const dmgPath = path.join(this.config.out, channel, pack.version, 'darwin', 'TradingView.dmg');
		const zipPath = path.join(this.config.out, channel, pack.version, 'darwin', 'TradingView.zip');

		const dmgCreation = this.packageCreator(pack.dmg.md5, dmgPath);
		const zipCreation = this.packageCreator(pack.zip.md5, zipPath);

		if (dmgCreation instanceof Promise) {
			promises.push(dmgCreation);
		}

		if (zipCreation instanceof Promise) {
			promises.push(zipCreation);
		}

		await Promise.all(promises);
	}

	private async handleLatest(channel: string, channelObj: {latest: string, additionalFiles?: string[], packages: PackageDescriptor[]}): Promise<void> {
		const latestPath = path.join(this.config.out, channel, 'latest', 'darwin');
		const ymlPath = path.join(latestPath, `${channel}-mac.yml`);
		const dmgPath = path.join(latestPath, 'TradingView.dmg');
		const latestPackage = channelObj.packages.find(pack => pack.version === channelObj.latest);
		const promises: Promise<void>[] = [];

		if (!latestPackage) {
			throw new Error('latest must be specified');
		}

		const dmgCreation = this.packageCreator(latestPackage.dmg.md5, dmgPath);

		if (dmgCreation instanceof Promise) {
			promises.push(dmgCreation);
		}

		const relativeZipPath = path.posix.join('..', '..', latestPackage.version, 'darwin', 'TradingView.zip');
		const sha512 = (await this.artifactProvider.getArtifactContent(latestPackage.sha512)).read().toString();

		const ymlContent = YmlContentTemplate
			.replace('$VERSION', latestPackage.version)
			.replace('$PATH', relativeZipPath)
			.replace('$SHA512', sha512)
			.replace('$DATE', this.releaseDate);

		promises.push(fs.promises.writeFile(ymlPath, ymlContent));

		channelObj.additionalFiles?.forEach(filePath => {
			const resolvedFilePath = path.resolve(filePath);
			const targetPath = path.join(latestPath, path.basename(resolvedFilePath));
			promises.push(fs.promises.copyFile(resolvedFilePath, targetPath));
		});

		await Promise.all(promises);
	}
}
