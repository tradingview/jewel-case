import { exit } from 'process';
import yargs from 'yargs';

import { initConfiguration } from './config.mjs';

import { apply, plan } from './index.mjs';
import { getMessageOfError } from './utils.mjs';

type CliType = Awaited<ReturnType<typeof yargsParsePromise.parse>>;
let cliInstance: CliType | undefined = undefined;

const yargsParsePromise = yargs(process.argv.slice(2))
	.option('config', { alias: 'c', description: 'Path to config file', string: true, default: './jewel-case.config.mjs' })
	.command('plan', 'Prepare repositories for deploy')
	.command('apply', 'Deploy repositories');

async function initCli(): Promise<void> {
	if (cliInstance) {
		throw new Error('CLI already initialized');
	}

	const tmp = await yargsParsePromise.parse();

	if (!cliInstance) {
		cliInstance = tmp;
	}
}

export function cli(): CliType {
	if (!cliInstance) {
		throw new Error('CLI must be initialized before use');
	}

	return cliInstance;
}

async function main(): Promise<number> {
	await initCli();
	await initConfiguration(cli().config);

	const command = cli()._[0];

	if (command === 'plan') {
		plan();
	}

	if (command === 'apply') {
		apply();
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
