import { type ArtifactoryClient, createArtifactoryClient } from 's3-groundskeeper';

import { get } from './http.mjs';

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

export interface Artifact {
	type : string,
	sha1 : string,
	sha256 : string,
	md5 : string,
	name : string
}

export class ArtifactoryHelper {
	private artifactoryClient: ArtifactoryClient;
	private buildsList?: BuildsList;

	constructor(host: string, apiKey: string, user: string) {
		this.artifactoryClient = createArtifactoryClient({protocol: 'https', host, apiKey, user});
	}

	public client(): ArtifactoryClient {
		return this.artifactoryClient;
	}

	public async artifactsByBuildNumber(project: string, buildNumber: string): Promise<Artifact[]> {
		const buildInfos = await this.buildInfosByNumber(project, buildNumber);
		const result: Artifact[] = [];

		for (const buildInfo of buildInfos) {
			for (const module of buildInfo.buildInfo.modules) {
				result.push(...module.artifacts);
			}
		}

		return result;
	}

	private async buildInfosByNumber(project: string, buildNumber: string): Promise<BuildInfo[]> {
		if (!this.artifactoryClient) {
			throw new Error('Artifactory client does not exists');
		}

		const result: BuildInfo[] = [];

		const buildsEndpoint = this.artifactoryClient.resolveUri(`api/build/${ project }`);;

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
