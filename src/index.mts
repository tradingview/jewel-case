import type { Config } from './config.mjs';
import { DebBuilder } from './deb/deb-builder.mjs';
import type { IBuilder } from './ibuilder.mjs';
import { JfrogArtifactsProvider } from './jfrog/jfrog-artifacts-provider.mjs';

export { type Config, createConfigProvider } from './config.mjs';

export function plan(config: Config): Promise<void[]> {
	const artifactsProvider = new JfrogArtifactsProvider(config);

	const builders: IBuilder[] = [];

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
