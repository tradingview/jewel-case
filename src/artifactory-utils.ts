import * as http from './http.js';

import { ArtifactoryClient, createArtifactoryClient } from 's3-groundskeeper';
import { configuration } from './config.js';
import type stream from 'stream';

let artifactoryHelperInstance: ArtifactoryHelper | undefined = undefined;

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
		}[],
		properties: {
			'buildInfo.env.CI_RUNNER_TAGS': string,
			'buildInfo.env.VERSION': string
		}
	}
}

export interface Artifact {
	type : string,
	sha1 : string,
	sha256 : string,
	md5 : string,
	name : string
}

export interface ArtifactoryHelperConfig {
	host: string;
	user: string;
	apiKey: string;
	project: string;
}

export class ArtifactoryHelper {
	private artifactoryClient?: ArtifactoryClient;
	private buildsList?: BuildsList;
	private project: string;

	constructor(config: ArtifactoryHelperConfig) {
		this.project = config.project;
		this.artifactoryClient = createArtifactoryClient({ protocol: 'https', host: config.host, apiKey: config.apiKey, user: config.user });
	}

	public async init(): Promise<void> {
		if (!this.artifactoryClient) {
			throw new Error('Artifactory client does not exists');
		}

		const apiEndpoint = this.artifactoryClient.resolveUri('api/build');
		const buildsEndpoint = `${apiEndpoint}/${this.project}`;

		const allBuilds = await http.get(buildsEndpoint);
		this.buildsList = JSON.parse(allBuilds.toString()) as BuildsList;
	}

	public client(): ArtifactoryClient {
		if (!this.artifactoryClient) {
			throw new Error('Artifactory client does not exists');
		}

		return this.artifactoryClient;
	}

	public macOsArtifactsByBuildNumber(buildNumber: string): Promise<Artifact[]> {
		return this.artifactsByBuildNumber(buildNumber, 'mac-shell');
	}

	public async windowsArtifactsByBuildNumber(buildNumber: string): Promise<Artifact[]> {
		return (await this.artifactsByBuildNumber(buildNumber, 'windows, code-signing')).filter(value => value.name.endsWith('.msix'));
	}

	public async debArtifactsByBuildNumber(buildNumber: string): Promise<Artifact[]> {
		return (await this.artifactsByBuildNumber(buildNumber, 'tvd-runner')).filter(value => value.name.endsWith('.deb'));
	}

	private async artifactsByBuildNumber(buildNumber: string, osKey: string): Promise<Artifact[]> {
		const buildInfo = await this.buildInfoByNumber(buildNumber, osKey);

		if (buildInfo.buildInfo.modules.length !== 1) {
			throw new Error('Build must contain only one module');
		}

		const firstModule = buildInfo.buildInfo.modules[0];

		if (!firstModule) {
			throw new Error('Build must contain only one module');
		}

		return firstModule.artifacts;
	}

	private async buildInfoByNumber(buildNumber: string, osKey: string): Promise<BuildInfo> {
		if (!this.artifactoryClient) {
			throw new Error('Artifactory client does not exists');
		}

		const apiEndpoint = this.artifactoryClient?.resolveUri('api/build');
		const buildsEndpoint = `${apiEndpoint}/${this.project}`;

		const buildTimes = (buildUri: string): Date[] => {
			const times: Date[] = [];

			this.buildsList?.buildsNumbers.forEach(build => {
				if (build.uri === `/${buildUri}`) {
					times.push(new Date(build.started));
				}
			});

			return times;
		};

		const buildInfoResult: Promise<Buffer | stream.Readable>[] = [];

		for (const value of buildTimes(buildNumber)) {
			const buildInfoEndpoint = `${buildsEndpoint}/${buildNumber}?started=${value.toISOString()}`;
			buildInfoResult.push(http.get(buildInfoEndpoint));
		}

		const result = (await Promise.all(buildInfoResult));

		for (const buildInfo of result) {
			const parsedInfo = JSON.parse(buildInfo.toString()) as BuildInfo;
			if (parsedInfo.buildInfo.properties['buildInfo.env.CI_RUNNER_TAGS'] === osKey) {
				return parsedInfo;
			}
		}

		throw new Error(`No build with build number: ${buildNumber} and osKey: ${osKey} found`);
	}
}

export function artifactoryHelper(): ArtifactoryHelper {
	if (!artifactoryHelperInstance) {
		const host = configuration().artifactoryHost;
		const user = configuration().artifactoryUser;
		const apiKey = configuration().artifactoryApiKey;
		const project = configuration().artifactoryProjectKey;

		if (!host) {
			throw new Error('Artifactory host must be specified');
		}

		if (!user) {
			throw new Error('Artifactory user must be specified');
		}

		if (!apiKey) {
			throw new Error('Artifactory API key must be specified');
		}

		if (!project) {
			throw new Error('Artifactory project key must be specified');
		}

		artifactoryHelperInstance = new ArtifactoryHelper({ host, user, apiKey, project });
	}

	return artifactoryHelperInstance;
}
