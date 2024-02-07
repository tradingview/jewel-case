export type ProviderType = 'jfrog';

export interface ArtifactProviderConfig {
	type: ProviderType,
	protocol: string,
	host: string,
	project: string,
	apiKey: string,
	user: string
}
