export default {
	// A preset that is used as a base for Jest's configuration
	preset: 'ts-jest/presets/default-esm',

	// Automatically clear mock calls, instances, contexts and results before every test
	clearMocks: true,

	// Indicates whether the coverage information should be collected while executing the test
	collectCoverage: true,

	// The directory where Jest should output its coverage files
	coverageDirectory: 'coverage',

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

	// A list of paths to directories that Jest should use to search for files in
	roots: ['./src'],

	// The number of seconds after which a test is considered as slow and reported as such in the results.
	slowTestThreshold: 10,
};
