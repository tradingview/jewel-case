import * as fs from 'fs';

import { spawnSync } from 'child_process';

export function createMetapointerContent(fileMd5Hash: string): string {
	return `#metapointer jfrogart\noid md5:${fileMd5Hash}`;
}

export function createFile(path: string, content: string): void {
	const dirPath = path.split('/').slice(0, -1)
		.join('/');

	createDir(dirPath);

	fs.writeFileSync(path, content);
}

export function createDir(dirName: string): void {
	if (!fs.existsSync(dirName)) {
		fs.mkdirSync(dirName, { recursive: true });
	}
}

export function ignorePromise<T>(promise: Promise<T>): void {
	promise.catch((error: unknown) => {
		const err = error as Error;
		console.warn(`Ignoring promise, but error: ${err.message}`);
		console.warn(err.stack);
	});
}

// eslint-disable-next-line max-params
export async function execToolToFile(tool: string, args: string[], outputPath?: string, append?: boolean): Promise<void> {
	if (!append && outputPath && fs.existsSync(outputPath)) {
		await fs.promises.unlink(outputPath);
	}

	const toolProcessResult = spawnSync(tool, args, { stdio: 'pipe', encoding: 'utf-8' });
	const toolOutput = toolProcessResult.stdout;

	const dumpToolOutput = (): void => {
		const toolErrOutput = toolProcessResult.stderr;
		if (toolOutput && toolOutput.length > 0) {
			console.log(toolOutput);
		}
		if (toolErrOutput && toolErrOutput.length > 0) {
			console.warn(toolErrOutput);
		}
	};

	if (outputPath) {
		console.log(`Execute ${tool} ${args.join(' ')} => ${outputPath}`);
		dumpToolOutput();
		if (append) {
			return fs.promises.appendFile(outputPath, toolOutput);
		}

		return fs.promises.writeFile(outputPath, toolOutput);
	}

	console.log(`Execute ${tool} ${args.join(' ')}`);
	dumpToolOutput();

	return Promise.resolve();
}

export function getMessageOfError(error: unknown): string {
	if (error === null || typeof error === 'undefined') {
		return '';
	}

	if (error instanceof Error) {
		return error.message;
	}

	if (typeof error === 'string') {
		return error;
	}

	if (typeof error === 'object') {
		return (error as { message?: string; }).message ?? 'unknown error';
	}

	return 'unknown error';
}
