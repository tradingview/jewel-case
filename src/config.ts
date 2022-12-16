import * as configFile from './jewel-case.config.mjs';

import { cli } from './cli.js';

let cfg: Config | undefined = undefined;

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
	exhaust = configFile.default.exhaust;

	constructor() {
		const ARTIFACTORY_HOST = 'ARTIFACTORY_HOST';
		const ARTIFACTORY_USER = 'ARTIFACTORY_USER';
		const ARTIFACTORY_API_KEY = 'ARTIFACTORY_API_KEY';
		const S3_ACCESS_KEY_ID = 'S3_ACCESS_KEY_ID';
		const S3_SECRET_ACCESS_KEY = 'S3_SECRET_ACCESS_KEY';
		const S3_REGION = 'S3_REGION';
		const S3_BUCKET = 'S3_BUCKET';
		const GPG_KEY_NAME = 'GPG_KEY_NAME';

		this.artifactoryHost = envToString(ARTIFACTORY_HOST) ?? cli.artifactoryHost;
		this.artifactoryUser = envToString(ARTIFACTORY_USER) ?? cli.artifactoryUser;
		this.artifactoryApiKey = envToString(ARTIFACTORY_API_KEY) ?? cli.artifactoryApiKey;
		this.artifactoryProjectKey = cli.artifactoryProjectKey;
		this.s3AccessKeyId = envToString(S3_ACCESS_KEY_ID) ?? cli.s3AccessKeyId;
		this.s3SecretAccessKey = envToString(S3_SECRET_ACCESS_KEY) ?? cli.s3SecretAccessKey;
		this.s3Region = envToString(S3_REGION) ?? cli.s3Region;
		this.s3Bucket = envToString(S3_BUCKET) ?? cli.s3Bucket;
		this.gpgKeyName = envToString(GPG_KEY_NAME) ?? cli.gpgKeyName;
	}
}

function envToString(envName: string): string | undefined {
	const value = process.env[envName];

	return value;
}

export function configuration(): Config {
	if (!cfg) {
		cfg = new Config();
	}

	return cfg;
}
