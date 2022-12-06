export default {
	"*": "ec",
	"*.{js,cjs,mjs,ts,cts,mts}": "cross-env ESLINT_USE_FLAT_CONFIG=true pnpm eslint -c eslint.config.mjs"
}
