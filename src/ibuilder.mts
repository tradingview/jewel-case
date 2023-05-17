export interface IBuilder {
	plan(): Promise<void>;
	apply(): void;
}
