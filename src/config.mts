import path from 'path';
import { pathToFileURL } from 'url';

interface IOConfig {
	sourceDir: string;
	repoOut: string;
	repoDir: string;
}

export class Config {
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

export async function createConfig(path: string): Promise<Config> {
	const configurationInstance = new Config(path);
	await configurationInstance.init();

	return configurationInstance;
}

