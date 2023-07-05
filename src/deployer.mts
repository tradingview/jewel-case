export interface Deployer {
	plan(): Promise<void>;
	apply(): void;
}
