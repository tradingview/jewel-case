import type { Artifact } from '../artifact-provider.mjs';

export interface DebBuilderConfig {
	out: string,
	gpgPublicKeyPath: string;
	gpgKeyName: string;
	applicationName: string;
	origin: string;
	repo: DebRepo;
}

type Distribution = string;
type UbuntuComponentsEnum = 'main' | 'universe' | 'restricted' | 'multiverse';

export type UbuntuComponent = {
	[key in UbuntuComponentsEnum]: string;
};

export interface DebDescriptor {
	version: string,
	artifact: Artifact
}

export interface DebRepo {
	[key: Distribution]: {
		[key in keyof UbuntuComponent]?: DebDescriptor[]
	}
}
