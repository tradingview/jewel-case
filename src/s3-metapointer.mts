import { createFile } from './fs.mjs';

export function content(fileMd5Hash: string): string {
	return `#metapointer jfrogart\noid md5:${fileMd5Hash}`;
}

// eslint-disable-next-line class-methods-use-this
export function createMetapointerFile(md5: string, fileName: string): void {
	createFile(fileName, content(md5));
}
