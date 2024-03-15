import * as path from 'path';
import { existsSync, promises as fsPromises, mkdirSync, rmdirSync, writeFileSync } from 'fs';
import { spawnSync } from 'child_process';

export function createFile(filePath: string, content: string): void {
	const dirPath = path.dirname(filePath);

	createDir(dirPath);

	writeFileSync(filePath, content);
}

export function createDir(dirName: string): void {
	if (!existsSync(dirName)) {
		mkdirSync(dirName, { recursive: true });
	}
}

export function removeDir(dirName: string): void {
	if (existsSync(dirName)) {
		rmdirSync(dirName, { recursive: true });
	}
}

// eslint-disable-next-line max-params
export async function execToolToFile(tool: string, args: string[], outputPath?: string, append?: boolean): Promise<void> {
	if (!append && outputPath && existsSync(outputPath)) {
		await fsPromises.unlink(outputPath);
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
			return fsPromises.appendFile(outputPath, toolOutput);
		}

		return fsPromises.writeFile(outputPath, toolOutput);
	}

	console.log(`Execute ${tool} ${args.join(' ')}`);
	dumpToolOutput();

	return Promise.resolve();
}
