'use strict';

module.exports = (path, options) => {
	const mjsExtRegex = /\.mjs$/iu;
	const resolver = options.defaultResolver;
	if (mjsExtRegex.test(path)) {
		try {
			return resolver(path.replace(mjsExtRegex, '.mts'), options);
		} catch {
			// use default resolver
		}
	}

	return resolver(path, options);
};
