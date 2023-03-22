export default {
	// A preset that is used as a base for Jest's configuration
	preset: 'ts-jest/presets/default-esm',

	// Automatically clear mock calls, instances, contexts and results before every test
	clearMocks: true,

	// Indicates whether the coverage information should be collected while executing the test
	collectCoverage: true,

	collectCoverageFrom: ['**/*.mts'],

	coveragePathIgnorePatterns: [
		'src/cli.mts',
		'src/config.mts',
		'src/utils.mts',
	],

	// The directory where Jest should output its coverage files
	coverageDirectory: '<rootDir>/../coverage',

	// Indicates which provider should be used to instrument code for coverage
	coverageProvider: 'v8',

	// An object that configures minimum threshold enforcement for coverage results
	coverageThreshold: {
		global: {
			branches: 100,
			functions: 100,
			lines: 100,
			statements: 100,
		},
	},

	// The number of seconds after which a test is considered as slow and reported as such in the results.
	slowTestThreshold: 10,

	extensionsToTreatAsEsm: ['.mts'],
	resolver: '<rootDir>/../tools/mjs-resolver.cjs',
	moduleFileExtensions: ['js', 'mts'],
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
