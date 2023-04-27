import { writeFileSync, mkdirSync, existsSync, rmdirSync } from 'fs';

export function createFile(path: string, content: string): void {
	const dirPath = path.split('/').slice(0, -1).join('/');

	createDir(dirPath);

	writeFileSync(path, content);
}

export function createDir(dirName: string): void {
	if (!existsSync(dirName)) {
		mkdirSync(dirName, { recursive: true });
	}
}

export function removeDir(dirName: string): void {
	if (existsSync(dirName)) {
		rmdirSync(dirName, {recursive: true});
	}
}

export function createMetapointerContent(fileMd5Hash: string): string {
	return `#metapointer jfrogart\noid md5:${fileMd5Hash}`;
}