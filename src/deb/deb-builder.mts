import type { Config } from '../config.mjs';
import type { IBuilder } from '../ibuilder.mjs';

export class DebBuilder implements IBuilder {
	private config: Config;
	private debRepo: {
		channel: string,
		debs: {
			name: string,
			md5: string
		}[]}[] = [];

	constructor(config: Config) {
		this.config = config;
	}

	public plan(config: Config): void {

	}

	public apply(config: Config): void {

	}
}
