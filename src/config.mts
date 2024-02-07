import path from 'path';
import { pathToFileURL } from 'url';

import type { ArtifactProviderConfig } from './artifact-provider-config.mjs';
import type { DebBuilderConfig } from './deb/deb-builder-config.mjs';
import type { Repo } from './repo.mjs';

interface BaseConfig {
	base: {
		out: string;
		repo: Repo;
	}
}

export type Config = BaseConfig & DebBuilderConfig & ArtifactProviderConfig;

export class ConfigProvider {
	private path: string;
	private configInstance: Config | undefined;

	constructor(path: string) {
		this.path = path;
	}

	async init(): Promise<void> {
		const resolvedPath = path.resolve(this.path);
		this.configInstance = (await import(pathToFileURL(resolvedPath).toString())).default as Config;
	}

	get config(): Config {
		if (!this.configInstance) {
			throw new Error('Config not initialized');
		}

		return this.configInstance;
	}
}

export async function createConfigProvider(path: string): Promise<ConfigProvider> {
	const configProviderInstance = new ConfigProvider(path);
	await configProviderInstance.init();

	return configProviderInstance;
}

