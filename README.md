# jewel-case

## Development
[Volta](https://volta.sh/) is recommended to install pinned version of Node. See `volta` field in the top-level [`package.json`](./package.json).

Lifecycle commands:
| Command                  | Description                             |
|--------------------------| ----------------------------------------|
| `npx pnpm install`       | install all dependencies for a project  |
| `npx pnpm husky install` | enable Git hooks                        |
| `npx pnpm build`         | build everything                        |
| `npx pnpm lint`          | lint all files                          |
| `npx pnpm lint-staged`   | lint all staged files                   |
| `npx pnpm test`          | run unit tests                          |

## Usage
#### CLI commands:
Build repositories according to config:
```sh
jewel-case plan <repo-out> [source-dir]
```
Distribute repository:
```sh
jewel-case apply <repo-dir>
```
#### Source dir layout
Layout example:
* `src`
	* `beta`
		* `1.0.19`
	* `stable`
		* `1.0.10`
		* `1.0.11`
		* `1.0.12`
		* `1.0.13`
		* `1.0.14`
		* `1.0.15`
		* `1.0.16`
		* `1.0.9`

Artifacts have to be uploaded with settled build number. See [JFROG Documentation](https://www.jfrog.com/confluence/display/JFROG/UploadArtifact). Version file must contain that build number:
```
PS src> cat .\stable\1.0.10
2830
```

#### Artifactory config:
| CLI key                   | Environment variable |
|---------------------------|----------------------|
| --artifactory-host        | ARTIFACTORY_HOST     |
| --artifactory-user        | ARTIFACTORY_USER     |
| --artifactory-api-key     | ARTIFACTORY_API_KEY  |
| --artifactory-project-key | -                    |

#### AWS S3 config:
| CLI key                   | Environment variable |
|---------------------------|----------------------|
| --s3-access-key-id        | S3_ACCESS_KEY_ID     |
| --s3-secret-access-key    | S3_SECRET_ACCESS_KEY |
| --s3-region               | S3_REGION            |
| --s3-bucket               | S3_BUCKET            |

#### Other config:
| CLI key        | Environment variable  | Description                  |
|----------------|-----------------------|------------------------------|
| --gpg-key-name | GPG_KEY_NAME          | Need for sign deb repository |

## Exhaust
To configure exhaust You'll need `jewel-case.config.mjs` file in directory with rules configured like this:
```ts
export default {
	msixS3: {
		msixName: 'TradingView',
		appInstaller: {
			name: 'TradingView',
			host: 'https://tvd-packages.tradingview.com',
			hoursBetweenUpdateChecks: 1,
			packageName: 'TradingView.Desktop',
			publisher: 'CN=&quot;TradingView, Inc.&quot;, O=&quot;TradingView, Inc.&quot;, S=Ohio, C=US',
		},
	},
};

```

Repository builders:
* msix-s3
* darwin-s3 _(in progress)_
* deb-s3 _(in progress)_
* rpm-s3 _(in progress)_

Distributors:
* [s3-groundskeeper](https://github.com/tradingview/s3-groundskeeper)
* msix-store _(in progress)_
* snap-store _(in progress)_
