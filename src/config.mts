import path from 'path';
import { pathToFileURL } from 'url';

import type { Deployer } from './deployer.mjs';

export interface Config {
	deployers: Deployer[];
}

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

