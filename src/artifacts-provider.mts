export interface Artifact {
	name: string,
	type: string,
	path: string,
	sha1: string,
	sha256: string,
	md5: string
}

export interface ArtifactsProvider {
	artifactsByBuildNumber(buildNumber: string): Promise<Artifact[]>;
	artifactUrl(artifact: Artifact): string;
}
