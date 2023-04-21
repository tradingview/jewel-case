import { Config } from './config.mjs';

export { Config, createConfig } from './config.mjs';

export function plan(config: Config): void {
	console.log('plan()');
}

export function apply(config: Config): void {
	console.log('apply()');
}
