import * as fs from 'fs';
import * as path from 'path';
import { TextEncoder } from 'util';

import type { Artifact, ArtifactoryHelper } from './artifactory-utils.js';
import type { Package, Repo, RepoBuilder } from './repo-builder.js';

import { createDir, createFile, createMetapointerContent } from './utils.js';

export class WindowsRepoBuilder implements RepoBuilder {
	private readonly artifactory: ArtifactoryHelper;
	private readonly repo: Repo;
	private readonly out: string;
	private readonly arch: string = 'x64';

	constructor(artifactory: ArtifactoryHelper, repo: Repo, out: string) {
		this.artifactory = artifactory;
		this.repo = repo;
		this.out = out;
	}

	public build(): Promise<void> {
		return this.prepareJfrogMetaFiles();
	}

	private async prepareJfrogMetaFiles(): Promise<void> {
		console.log('WindowsBuilder: prepareJfrogMetaFiles');

		const channelResult: Promise<void>[] = [];
		const latestResult: Promise<void>[] = [];

		for (const [channel, release] of this.repo) {
			channelResult.push(this.makeChannel(channel, release.packages));
		}

		await Promise.all(channelResult);

		for (const [channel, release] of this.repo) {
			latestResult.push(this.makeLatest(channel, release.highest));
		}

		// eslint-disable-next-line no-empty-function
		return Promise.all(latestResult).then(() => {});
	}

	private async artifactsWithVersion(version: string, buildNumber: string): Promise<{ version: string, artifacts: Artifact[] }> {
		return { version, artifacts: await this.artifactory.windowsArtifactsByBuildNumber(buildNumber) };
	}

	private async makeChannel(channel: string, packs: Package[]): Promise<void> {
		const artifactsResult: Promise<{ version: string, artifacts: Artifact[] }>[] = [];

		packs.forEach(pack => {
			artifactsResult.push(this.artifactsWithVersion(pack.version, pack.buildNumber));
		});

		const artifacts = await Promise.all(artifactsResult);

		artifacts.forEach(value => {
			console.log(`WindowsBuilder: Processing ${value.version}`);
			value.artifacts.forEach(artifact => {
				const msixDir = path.join(this.out, channel, value.version, 'win32', this.arch);
				createDir(msixDir);
				createMsix(msixDir, artifact.md5);
			});
		});
	}

	private async makeLatest(channel: string, highest: Package): Promise<void> {
		console.log('WindowsBuilder: makeRelease');

		const latestDir = path.join(this.out, channel, 'latest', 'win32');
		createDir(latestDir);

		this.createAppInstallerFile(latestDir, `${highest.version}.${highest.buildNumber}`, channel);
		await fs.promises.copyFile(path.join(this.out, channel, highest.version, 'win32', this.arch, 'TradingView.msix'),
			path.join(latestDir, 'TradingView.msix'));
	}

	private createAppInstallerFile(out: string, version: string, channel: string): void {
		const appInstallerContent = this.appInstallerFileContent(version, channel);
		const adjustedAppInstallerContent = adjustAppinstallerSize(appInstallerContent);

		createFile(`${out}/TradingView.appinstaller`, adjustedAppInstallerContent);
	}

	private appInstallerFileContent(version: string, channel: string): string {
		return `<?xml version="1.0" encoding="utf-8"?>
		<AppInstaller
			Uri="https://tvd-packages.tradingview.com/${channel}/latest/win32/TradingView.appinstaller"
			Version="${version}"
			xmlns="http://schemas.microsoft.com/appx/appinstaller/2017/2">
			<MainPackage
			Name="TradingView.Desktop"
			Version="${version}"
			Publisher="CN=&quot;TradingView, Inc.&quot;, O=&quot;TradingView, Inc.&quot;, S=Ohio, C=US"
			ProcessorArchitecture="x64"
			Uri="https://tvd-packages.tradingview.com/${channel}/${version}/win32/${this.arch}/TradingView.msix" />
			<UpdateSettings>
				<OnLaunch HoursBetweenUpdateChecks="1" />
			</UpdateSettings>
		</AppInstaller>\n`;
	}
}

function createMsix(out: string, md5: string): void {
	createFile(`${out}/TradingView.msix`, createMetapointerContent(md5));
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
