import yargs from 'yargs';

type CliType = Awaited<ReturnType<typeof yargsParsePromise.parse>>;
let cliInstance: CliType | undefined = undefined;

const yargsParsePromise = yargs(process.argv.slice(2))
	.option('artifactory-host', { description: 'JFrog Artifactory host. Alternale env:ARTIFACTORY_HOST', group: 'JFrog Artifactory:', string: true })
	.option('artifactory-user', { description: 'JFrog Artifactory username. Alternale env:ARTIFACTORY_USER', group: 'JFrog Artifactory:', string: true })
	.option('artifactory-api-key', { description: 'JFrog Artifactory ApiKey. Alternale env:ARTIFACTORY_API_KEY', group: 'JFrog Artifactory:', string: true })
	.option('artifactory-project-key', { description: 'JFrog Artifactory Project key.', group: 'JFrog Artifactory:', string: true })
	.option('s3-access-key-id', { description: 'Amazon S3 access key id. Alternale env:S3_ACCESS_KEY_ID', group: 'AWS S3:', string: true })
	.option('s3-secret-access-key', { description: 'Amazon S3 secret access key. Alternale env:S3_SECRET_ACCESS_KEY', group: 'AWS S3:', string: true })
	.option('s3-region', { description: 'Amazon S3 region. Alternale env:S3_REGION', group: 'AWS S3:', string: true })
	.option('s3-bucket', { description: 'Amazon S3 bucket. Alternale env:S3_BUCKET', group: 'AWS S3:', string: true })
	.option('gpg-key-name', { description: 'Signing GPG key name. Alternale env:GPG_KEY_NAME', group: 'Linux specific:', string: true })
	.command('plan <repo-out> [source-dir]', 'Prepare repositories for deploy', yargs => {
		yargs.positional('repo-out', { describe: 'Outup dir wich will contain prepeared repository', type: 'string', default: 'out' })
			.positional('source-dir', { describe: 'Source dir wich contains releases description', type: 'string' });
	})
	.command('apply <repo-dir>', 'Deploy repositories', yargs => {
		yargs.positional('repo-dir', { describe: 'Source dir wich contains repository prepeared before. Only for S3 deploying', type: 'string' });
	});

export async function initCli(): Promise<void> {
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
