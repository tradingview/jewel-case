import type { Config } from './config.mjs';
import { DebBuilder } from './deb/deb-builder.mjs';
import type { Deployer } from './deployer.mjs';
import JfrogArtifactsProvider from './jfrog/artifacts-provider.mjs';

export { type Config, createConfigProvider } from './config.mjs';

export function plan(config: Config): Promise<void[]> {
	const artifactsProvider = new JfrogArtifactsProvider(config);

	const builders: Deployer[] = [];

	if (config.debBuilder) {
		builders.push(new DebBuilder(artifactsProvider, config));
	}

	const planPromises: Promise<void>[] = [];

	for (const builder of builders) {
		planPromises.push(builder.plan());
	}

	return Promise.all(planPromises);
}

export function apply(): void {
	console.log('apply()');
}
