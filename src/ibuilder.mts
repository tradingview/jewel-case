import { Config } from './config.mjs';

export interface IBuilder {
	plan(config: Config): void;
	apply(config: Config): void;
}
