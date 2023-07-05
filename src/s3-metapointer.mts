export default function metapointerContent(fileMd5Hash: string): string {
	return `#metapointer jfrogart\noid md5:${fileMd5Hash}`;
}
