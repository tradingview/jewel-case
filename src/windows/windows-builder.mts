import * as fs from 'fs';
import * as path from 'path';

import { TextEncoder } from 'util';

import type { Artifact } from '../artifact-provider.mjs';
import type { Deployer } from '../deployer.mjs';

type Channel = string;

export interface PackageDescriptor {
	version: string,
	buildNumber: string,
	msix: Artifact
}

export interface WindowsRepo {
	[key: Channel]: {
		latest: string,
		additionalFiles?: string[],
		packages: PackageDescriptor[]
	}
}

export interface Config {
	host: string,
	out: string,
	repo: WindowsRepo
}

function interateChannels(repo: WindowsRepo, callback: (channel: string, channelObj: {
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

function iteratePackages(repo: WindowsRepo, callback: (channel: string, pack: PackageDescriptor) => void): void {
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

const AppInstallerContentTemplate =
`<?xml version="1.0" encoding="utf-8"?>
<AppInstaller
	Uri="$APPINSTALLER_URI"
	Version="$APPINSTALLER_VERSION"
	xmlns="http://schemas.microsoft.com/appx/appinstaller/2017/2">
	<MainPackage
		Name="$PACKAGE_NAME"
		Version="$PACKAGE_VERSION"
		Publisher="$PUBLISHER"
		ProcessorArchitecture="$ARCH"
		Uri="$MSIX_URI"
	/>
	<UpdateSettings>
		<OnLaunch HoursBetweenUpdateChecks="$UPDATES_INTERVAL" />
	</UpdateSettings>
</AppInstaller>\n`;

export class WindowsBuilder implements Deployer {
	private readonly config: Config;
	private readonly packageCreator: (md5: string, path: string) => (Promise<void> | void);

	constructor(config: Config, packageCreator: (md5: string, path: string) => (Promise<void> | void)) {
		this.config = config;
		this.packageCreator = packageCreator;
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
		const msixPath = path.join(this.config.out, channel, pack.version, 'win32', 'TradingView.msix');

		const msixCreation = this.packageCreator(pack.msix.md5, msixPath);

		if (msixCreation instanceof Promise) {
			await msixCreation;
		}
	}

	private async handleLatest(channel: string, channelObj: {latest: string, additionalFiles?: string[], packages: PackageDescriptor[]}): Promise<void> {
		const latestPath = path.posix.join(channel, 'latest', 'win32');
		const appinstallerPath = path.posix.join(latestPath, 'Tradingview.appinstaller');
		const msixPath = path.join(latestPath, 'TradingView.msix');
		const latestPackage = channelObj.packages.find(pack => pack.version === channelObj.latest);
		const promises: Promise<void>[] = [];

		if (!latestPackage) {
			throw new Error('latest must be specified');
		}

		const msixCreation = this.packageCreator(latestPackage.msix.md5, path.posix.join(this.config.out, msixPath));

		if (msixCreation instanceof Promise) {
			promises.push(msixCreation);
		}

		const appinstallerUri = new URL(path.posix.join(this.config.host, appinstallerPath)).toString();
		const appinstallerVersion = `${latestPackage.version}.${latestPackage.buildNumber}`;
		const packageName = 'TradingView.Desktop';
		const packageVersion = appinstallerVersion;
		const publisher = 'CN=&quot;TradingView, Inc.&quot;, O=&quot;TradingView, Inc.&quot;, S=Ohio, C=US';
		const msixUri = new URL(path.posix.join(this.config.host, channel, latestPackage.version, 'win32', 'x64', 'TradingView.msix')).toString();

		const appinstallerContent = AppInstallerContentTemplate
			.replace('$APPINSTALLER_URI', appinstallerUri)
			.replace('$APPINSTALLER_VERSION', appinstallerVersion)
			.replace('$PACKAGE_NAME', packageName)
			.replace('$PACKAGE_VERSION', packageVersion)
			.replace('$PUBLISHER', publisher)
			.replace('$ARCH', 'x64')
			.replace('$MSIX_URI', msixUri)
			.replace('$UPDATES_INTERVAL', '1');

		promises.push(fs.promises.writeFile(path.posix.join(this.config.out, appinstallerPath), adjustAppinstallerSize(appinstallerContent)));

		channelObj.additionalFiles?.forEach(filePath => {
			const resolvedFilePath = path.resolve(filePath);
			const targetPath = path.join(this.config.out, latestPath, path.basename(resolvedFilePath));
			promises.push(fs.promises.copyFile(resolvedFilePath, targetPath));
		});

		await Promise.all(promises);
	}
}

function adjustAppinstallerSize(appInstallerContent: string): string {
	const encoder = new TextEncoder();
	const appInstallerRequiredSize = 4096;

	const createFillComment = (fillComment: string): string => `<!--${fillComment}-->`;

	const appInstallerContentSize = encoder.encode(appInstallerContent).length;
	const fillCommentSize =	appInstallerRequiredSize - appInstallerContentSize - encoder.encode(createFillComment('')).length;

	if (fillCommentSize >= 0) {
		const commentStr = new Array(fillCommentSize + 1).join('X');
		return `${appInstallerContent}${createFillComment(commentStr)}`;
	}

	throw new Error('Appinstaller file is too big');
}
