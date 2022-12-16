import { Repo, RepoBuilder, scanSourceDir } from './repo-builder.js';

import { artifactoryHelper } from './artifactory-utils.js';
import { configuration } from './config.js';
import { WindowsRepoBuilder } from './windows-repo-builder.js';

export async function plan(outDir: string, sourceDir: string): Promise<void> {
	console.log(outDir);
	console.log(sourceDir);

	checkConfig('plan');

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

	checkConfig('apply');
}

function checkConfig(command: 'plan' | 'apply'): void {
	console.debug('Checking configuration');

	if (command === 'plan') {
		// const hasS3 = configuration().exhaust.some(value => value.type.endsWith('s3'));
		const linuxDebS3 = configuration().exhaust.some(value => value.type.includes('linux-deb-s3'));

		if (linuxDebS3) {
			if (!configuration().gpgKeyName) {
				throw new Error('GPG key must be specified');
			}
		}
	}

	console.debug('Checking configuration done');
}

function createBuilders(repo: Repo, outDir: string): RepoBuilder[] {
	const builders: RepoBuilder[] = [];
	const hasMsixS3 = configuration().exhaust.some(value => value.type.endsWith('msix-s3'));

	if (hasMsixS3) {
		builders.push(new WindowsRepoBuilder(artifactoryHelper(), repo, outDir));
	}

	return builders;
}
