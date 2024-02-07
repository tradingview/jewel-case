export type ProviderType = 'jfrog';

export interface ArtifactProviderConfig {
	artifactsProvider: {
		type: ProviderType,
		protocol: string,
		host: string,
		project: string,
		apiKey: string,
		user: string
	}
}
