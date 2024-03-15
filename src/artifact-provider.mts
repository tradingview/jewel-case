import type { ByteRange } from 's3-groundskeeper';
import type { IncomingMessage } from 'http';

export interface Artifact {
	name: string,
	type: string,
	path: string,
	sha1: string,
	sha256: string,
	md5: string
}

export interface ArtifactProvider {
	artifactsByBuildNumber(buildNumber: string): Promise<Artifact[]>;
	artifactUrl(artifact: Artifact): Promise<URL>;
	getArtifactContent(artifact: Artifact, range?: ByteRange): Promise<IncomingMessage>;
}
