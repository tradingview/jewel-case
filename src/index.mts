import type { Config } from './config.mjs';

export { type Config, createConfigProvider } from './config.mjs';

export async function plan(config: Config): Promise<void> {
	const planPromises: Promise<void>[] = [];

	for (const deployer of config.deployers) {
		planPromises.push(deployer.plan());
	}

	await Promise.all(planPromises);
}

export function apply(): void {
	console.log('apply()');
}
