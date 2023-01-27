import path from 'path';
import { pathToFileURL } from 'url';

let configurationInstance: Config | undefined = undefined;

interface IOConfig {
	sourceDir: string;
	repoOut: string;
	repoDir: string;
}

class Config {
	path: string;
	configFile: IOConfig | undefined;

	constructor(path: string) {
		this.path = path;
	}

	async init(): Promise<void> {
		const resolvedPath = path.resolve(this.path);
		this.configFile = (await import(pathToFileURL(resolvedPath).toString())).default as IOConfig;
	}
}

export function initConfiguration(path: string): Promise<void> {
	if (configurationInstance) {
		throw new Error('Configuration already initialized');
	}

	configurationInstance = new Config(path);
	return configurationInstance.init();
}

export function configuration(): Config {
	if (!configurationInstance) {
		throw new Error('Configuration must be initialized before use');
	}

	return configurationInstance;
}
