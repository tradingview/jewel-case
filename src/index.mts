import type { Config } from './config.mjs';
import { DebBuilder } from './deb/deb-builder.mjs';
import type { IBuilder } from './ibuilder.mjs';
import { JfrogArtifactsProvider } from './jfrog/jfrog-artifacts-provider.mjs';

export { type Config, createConfigProvider } from './config.mjs';

export async function plan(config: Config): Promise<void> {
	const artifactsProvider = new JfrogArtifactsProvider(config);

	const builders: IBuilder[] = [];

	if (config.debBuilder) {
		builders.push(new DebBuilder(artifactsProvider, config));
	}

	for (const builder of builders) {
		await builder.plan();
	}

	console.log('plan()');
}

export function apply(): void {
	console.log('apply()');
}
