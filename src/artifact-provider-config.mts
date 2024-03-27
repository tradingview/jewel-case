export type ProviderType = 'jfrog';

export interface ArtifactProviderConfig {
	type: ProviderType,
	host: string,
	project: string,
	apiKey: string,
	user: string
}
