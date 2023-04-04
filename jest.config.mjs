export default {
	// A preset that is used as a base for Jest's configuration
	preset: 'ts-jest/presets/default-esm',

	// Automatically clear mock calls, instances, contexts and results before every test
	clearMocks: true,

	// The number of seconds after which a test is considered as slow and reported as such in the results.
	slowTestThreshold: 10,

	extensionsToTreatAsEsm: ['.mts'],
	resolver: '<rootDir>/../tools/mjs-resolver.cjs',
	moduleFileExtensions: ['js', 'mjs', 'mts'],
	testRegex: ['.*.spec.mts'],
	transform: {
		// to process mts with `ts-jest`
		'^.+\\.mts$': [
			'ts-jest',
			{
				useESM: true,
			},
		],
	},
};
