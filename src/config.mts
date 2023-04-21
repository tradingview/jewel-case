import path from 'path';
import { pathToFileURL } from 'url';
import type { DebConfig } from './deb/deb-config.mjs';

interface IOConfig {
	sourceDir: string;
	repoOut: string;
	repoDir: string;
}

export class Config {
	path: string;
	config: (IOConfig & DebConfig) | undefined;

	constructor(path: string) {
		this.path = path;
	}

	async init(): Promise<void> {
		const resolvedPath = path.resolve(this.path);
		this.config = (await import(pathToFileURL(resolvedPath).toString())).default as (IOConfig & DebConfig);
	}
}

export async function createConfig(path: string): Promise<Config> {
	const configurationInstance = new Config(path);
	await configurationInstance.init();

	return configurationInstance;
}

