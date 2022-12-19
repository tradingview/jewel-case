import { Repo, RepoBuilder, scanSourceDir } from './repo-builder.js';

import { artifactoryHelper } from './artifactory-utils.js';
import { configuration } from './config.js';
import { WindowsRepoBuilder } from './windows-repo-builder.js';

export async function plan(outDir: string, sourceDir: string): Promise<void> {
	await artifactoryHelper().init();
	const repo = await scanSourceDir(sourceDir);
	const builders = createBuilders(repo, outDir);

	const repoBuildResilts: Promise<void>[] = [];
	builders.forEach(builder => {
		repoBuildResilts.push(builder.build());
	});

	await Promise.all(repoBuildResilts);
}

export function apply(repoDir?: string): void {
	console.log(repoDir);
}

function createBuilders(repo: Repo, outDir: string): RepoBuilder[] {
	const builders: RepoBuilder[] = [];
	const hasMsixS3 = Boolean(configuration().exhaust?.msixS3);

	if (hasMsixS3) {
		builders.push(new WindowsRepoBuilder(artifactoryHelper(), repo, outDir));
	}

	return builders;
}
