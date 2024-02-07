import { type ArtifactoryClient, type ArtifactoryItemMeta, createArtifactoryClient } from 's3-groundskeeper';

import { createFile } from '../fs.mjs';
import { get } from '../http.mjs';

import type { Artifact, ArtifactProvider } from '../artifact-provider.mjs';
import type { ArtifactProviderConfig } from '../artifact-provider-config.mjs';
import metapointerContent from '../s3-metapointer.mjs';

interface BuildsList {
	buildsNumbers: {
		uri: string,
		started: string
	}[]
}

interface BuildInfo {
	buildInfo: {
		modules: {
			artifacts: Artifact[]
		}[]
	}
}

export default class JfrogArtifactProvider implements ArtifactProvider {
	private artifactoryClient: ArtifactoryClient;
	private buildsList?: BuildsList;

	private readonly config: ArtifactProviderConfig;

	constructor(config: ArtifactProviderConfig) {
		this.config = config;
		this.artifactoryClient = createArtifactoryClient({
			protocol: this.config.artifactsProvider.protocol,
			host: this.config.artifactsProvider.host,
			apiKey: this.config.artifactsProvider.apiKey,
			user: this.config.artifactsProvider.user,
		});
	}

	public async artifactsByBuildNumber(buildNumber: string): Promise<Artifact[]> {
		const buildInfos = await this.buildInfosByNumber(buildNumber);
		const result: Artifact[] = [];

		for (const buildInfo of buildInfos) {
			for (const module of buildInfo.buildInfo.modules) {
				result.push(...module.artifacts);
			}
		}

		return result;
	}

	public async artifactUrl(artifact: Artifact): Promise<string> {
		const aqlItemField = 'actual_md5';

		const artQueryResult = await this.artifactoryClient.query<ArtifactoryItemMeta>(`items.find({"${aqlItemField}": "${artifact.md5}"}).include("*")`);
		if (artQueryResult.results.length === 0) {
			throw new Error(`No artifactory item found for ("${aqlItemField}": "${artifact.md5}"}`);
		} else if (artQueryResult.results.length > 1) {
			throw new Error(`Expected single artifactory item for ("${aqlItemField}": "${artifact.md5}"}`);
		}

		const item = artQueryResult.results[0];

		if (!item) {
			throw new Error(`No artifactory item found for ("${aqlItemField}": "${artifact.md5}"}`);
		}

		return this.artifactoryClient.resolveUri(item);
	}

	// eslint-disable-next-line class-methods-use-this
	public createMetapointerFile(artifact: Artifact, fileName: string): void {
		createFile(fileName, metapointerContent(artifact.md5));
	}

	private async buildInfosByNumber(buildNumber: string): Promise<BuildInfo[]> {
		if (!this.artifactoryClient) {
			throw new Error('Artifactory client does not exists');
		}

		const result: BuildInfo[] = [];

		const buildsEndpoint = this.artifactoryClient.resolveUri(`api/build/${this.config.artifactsProvider.project}`);

		if (!this.buildsList) {
			const allBuilds = await get(buildsEndpoint);
			this.buildsList = JSON.parse(allBuilds.toString()) as BuildsList;
		}

		const buildTimes = (buildUri: string): Date[] => {
			const times: Date[] = [];

			this.buildsList?.buildsNumbers.forEach(build => {
				if (build.uri === `/${buildUri}`) {
					times.push(new Date(build.started));
				}
			});

			return times;
		};

		const infoPromises: Promise<Buffer>[] = [];

		for (const value of buildTimes(buildNumber)) {
			const buildInfoEndpointUrl = new URL(buildNumber, buildsEndpoint);
			buildInfoEndpointUrl.searchParams.set('started', value.toISOString());
			infoPromises.push(get(buildInfoEndpointUrl.toString()));
		}

		const infos = await Promise.all(infoPromises);

		infos.forEach(info => {
			const buildInfo = JSON.parse(info.toString()) as BuildInfo;
			result.push(buildInfo);
		});

		return result;
	}
}
