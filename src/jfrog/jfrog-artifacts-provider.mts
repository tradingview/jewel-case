import { type ArtifactoryClient, createArtifactoryClient, type ArtifactoryItemMeta } from 's3-groundskeeper';

import { get } from '../http.mjs';
import type { Artifact, ArtifactsProvider } from '../artifacts-provider.mjs';
import type { ArtifactsProviderConfig } from '../artifacts-provider-config.mjs';

export interface BuildsList {
	buildsNumbers: {
		uri: string,
		started: string
	}[]
}

export interface BuildInfo {
	buildInfo: {
		modules: {
			artifacts: Artifact[]
		}[]
	}
}

export class JfrogArtifactsProvider implements ArtifactsProvider {
	private artifactoryClient: ArtifactoryClient;
	private buildsList?: BuildsList;

	private readonly config: ArtifactsProviderConfig;

	constructor(config: ArtifactsProviderConfig) {
		this.config = config;		
		this.artifactoryClient = createArtifactoryClient({
			protocol: this.config.artifactsProvider.protocol,
			host: this.config.artifactsProvider.host,
			apiKey: this.config.artifactsProvider.apiKey, 
			user: this.config.artifactsProvider.user
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
		}
		else if (artQueryResult.results.length > 1) {
			throw new Error(`Expected single artifactory item for ("${aqlItemField}": "${artifact.md5}"}`);
		}
	
		const item = artQueryResult.results[0];
		
		if (!item) {
			throw new Error(`No artifactory item found for ("${aqlItemField}": "${artifact.md5}"}`);
		}
		
		return this.artifactoryClient.resolveUri(item);
	}

	private async buildInfosByNumber(buildNumber: string): Promise<BuildInfo[]> {
		if (!this.artifactoryClient) {
			throw new Error('Artifactory client does not exists');
		}

		const result: BuildInfo[] = [];

		const buildsEndpoint = this.artifactoryClient.resolveUri(`api/build/${ this.config.artifactsProvider.project }`);;

		if (!this.buildsList) {
			const allBuilds = await get(buildsEndpoint);
			this.buildsList = JSON.parse(allBuilds.toString()) as BuildsList;
		}

		const buildTimes = (buildUri: string): Date[] => {
			const times: Date[] = [];
	
			this.buildsList?.buildsNumbers.forEach(build => {
				if (build.uri === `/${ buildUri}`) {
					times.push(new Date(build.started));
				}
			});
		
			return times;
		};

		for (const value of buildTimes(buildNumber)) {
			const buildInfoEndpoint = `${ buildsEndpoint }/${ buildNumber }?started=${ value.toISOString() }`;
			const info = (await get(buildInfoEndpoint)).toString();
			const buildInfo = JSON.parse(info) as BuildInfo;

			result.push(buildInfo);
		}

		return result;
	}
}
