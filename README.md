# jewel-case

## Development
[Volta](https://volta.sh/) is recommended to install pinned versions of Node and pnpm. See `volta` field in the top-level [`package.json`](./package.json). Please also set `VOLTA_FEATURE_PNPM` environment variable to value `1`.

Lifecycle commands:
| Command                  | Description                             |
|--------------------------| ----------------------------------------|
| `pnpm install`       | install all dependencies for a project  |
| `pnpm husky install` | enable Git hooks                        |
| `pnpm build`         | build everything                        |
| `pnpm lint`          | lint all files                          |
| `pnpm lint-staged`   | lint all staged files                   |
| `pnpm src:test`      | run unit tests                          |
| `pnpm tests:start`   | run integration tests                   |
| `pnpm test`          | run all tests                           |

Recommended Visual Studio Code extensions:

- [`Orta.vscode-jest`](https://marketplace.visualstudio.com/items?itemName=Orta.vscode-jest)
