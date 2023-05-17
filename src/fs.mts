import * as path from 'path';
import { existsSync, mkdirSync, rmdirSync, writeFileSync } from 'fs';

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

export function createMetapointerContent(fileMd5Hash: string): string {
	return `#metapointer jfrogart\noid md5:${fileMd5Hash}`;
}
