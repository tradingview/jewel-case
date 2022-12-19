import { exit } from 'process';

import { apply, plan } from './jewel-case.js';
import { cli, initCli } from './cli.js';

import { getMessageOfError } from './utils.js';
import { initConfiguration } from './config.js';

async function main(): Promise<number> {
	await initCli();
	await initConfiguration();

	const command = cli()._[0];

	if (command === 'plan') {
		await plan(cli()['repo-out'] as string, cli()['source-dir'] as string);
	}

	if (command === 'apply') {
		apply(cli()['repo-dir'] as string);
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
