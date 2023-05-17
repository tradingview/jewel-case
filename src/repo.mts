export interface Package {
	version: string,
	buildNumber: string
}

export interface Packages {
	packages: Package[],
	highest: Package,
}

export type Channel = string;
export type Repo = {
	channel: Channel,
	packages: Packages
}[]
