import type { Config } from './config.mjs';
export type { Config };
export type { Artifact, ArtifactProvider } from './artifact-provider.mjs';
export type { ProviderType, ArtifactProviderConfig } from './artifact-provider-config.mjs';
export type { DebBuilderConfig, DebDescriptor, DebRepo } from './deb/deb-builder-config.mjs';
export { DebBuilder } from './deb/deb-builder.mjs';
export { default as JfrogArtifactProvider } from './jfrog/artifact-provider.mjs';
export { createMetapointerFile as createS3MetapointerFile } from './s3-metapointer.mjs';

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
