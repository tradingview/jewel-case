import { exit } from 'process';
import yargs from 'yargs';

import { apply, createConfigProvider, plan } from './index.mjs';
import { getMessageOfError } from './utils.mjs';

type CommandLineArgs = Awaited<ReturnType<typeof yargsParsePromise.parse>>;

const yargsParsePromise = yargs(process.argv.slice(2))
	.option('config', { alias: 'c', description: 'Path to config file', string: true, default: './jewel-case.config.mjs' })
	.command('plan', 'Prepare repositories for deploy')
	.command('apply', 'Deploy repositories');

async function main(): Promise<number> {
	const args: CommandLineArgs = await yargsParsePromise.parse();
	const command = args._[0];

	const configProvider = await createConfigProvider(args.config);

	if (command === 'plan') {
		await plan(configProvider.config);
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
