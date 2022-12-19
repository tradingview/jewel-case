import { apply, plan } from './jewel-case.js';
import { getMessageOfError } from './utils.js';

import { cli } from './cli.js';
import { configuration } from './config.js';
import { exit } from 'process';

async function main(): Promise<number> {
	const command = cli._[0];
	await configuration().init();

	if (command === 'plan') {
		await plan(cli['repo-out'] as string, cli['source-dir'] as string);
	}

	if (command === 'apply') {
		apply(cli['repo-dir'] as string);
	}

	return 0;
}

main().then((code: number) => {
	if (!code) {
		exit(code);
	}
})
	.catch((error: unknown) => {
		console.error(getMessageOfError(error));
		exit(-1);
	});
