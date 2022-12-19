import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';

import { cli } from './cli.js';
import type { MsixS3Config } from './windows-repo-builder.js';

let configurationInstance: Config | undefined = undefined;

type ExhaustConfig = MsixS3Config;

class Config {
	artifactoryHost: string | undefined;
	artifactoryUser: string | undefined;
	artifactoryApiKey: string | undefined;
	artifactoryProjectKey: string | undefined;
	s3AccessKeyId: string | undefined;
	s3SecretAccessKey: string | undefined;
	s3Region: string | undefined;
	s3Bucket: string | undefined;
	gpgKeyName: string | undefined;
	exhaust: ExhaustConfig | undefined;

	constructor() {
		const ARTIFACTORY_HOST = 'ARTIFACTORY_HOST';
		const ARTIFACTORY_USER = 'ARTIFACTORY_USER';
		const ARTIFACTORY_API_KEY = 'ARTIFACTORY_API_KEY';
		const S3_ACCESS_KEY_ID = 'S3_ACCESS_KEY_ID';
		const S3_SECRET_ACCESS_KEY = 'S3_SECRET_ACCESS_KEY';
		const S3_REGION = 'S3_REGION';
		const S3_BUCKET = 'S3_BUCKET';
		const GPG_KEY_NAME = 'GPG_KEY_NAME';

		this.artifactoryHost = envToString(ARTIFACTORY_HOST) ?? cli().artifactoryHost;
		this.artifactoryUser = envToString(ARTIFACTORY_USER) ?? cli().artifactoryUser;
		this.artifactoryApiKey = envToString(ARTIFACTORY_API_KEY) ?? cli().artifactoryApiKey;
		this.artifactoryProjectKey = cli().artifactoryProjectKey;
		this.s3AccessKeyId = envToString(S3_ACCESS_KEY_ID) ?? cli().s3AccessKeyId;
		this.s3SecretAccessKey = envToString(S3_SECRET_ACCESS_KEY) ?? cli().s3SecretAccessKey;
		this.s3Region = envToString(S3_REGION) ?? cli().s3Region;
		this.s3Bucket = envToString(S3_BUCKET) ?? cli().s3Bucket;
		this.gpgKeyName = envToString(GPG_KEY_NAME) ?? cli().gpgKeyName;
	}

	async init(): Promise<void> {
		const resolvedPath = path.resolve(process.cwd(), 'jewel-case.config.mjs');
		if (resolvedPath && fs.existsSync(resolvedPath)) {
			this.exhaust = (await import(pathToFileURL(resolvedPath).toString())).default as ExhaustConfig;

			return;
		}

		throw new Error('jewel-case.config.mjs not found');
	}
}

function envToString(envName: string): string | undefined {
	const value = process.env[envName];

	return value;
}

export function initConfiguration(): Promise<void> {
	if (configurationInstance) {
		throw new Error('Configuration already initialized');
	}

	configurationInstance = new Config();
	return configurationInstance.init();
}

export function configuration(): Config {
	if (!configurationInstance) {
		throw new Error('Configuration must be initialized before use');
	}

	return configurationInstance;
}
