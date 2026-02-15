# github-app-auth-kit

A minimal, dependency-free TypeScript toolkit for GitHub App authentication.

Use it to:

- mint short-lived GitHub App JWTs
- resolve installation IDs from `owner/repo`
- create installation access tokens
- work in Node, edge runtimes, and GitHub Enterprise
- ship in both ESM and CommonJS projects

## Why this library

- Small surface area with strong types
- Works in three styles: one-shot, client instance, or low-level calls
- Runtime-agnostic (bring your own `fetch` if needed)
- Designed for clear errors and predictable behavior

## Install

```bash
pnpm add github-app-auth-kit
```

## Quick start

```ts
import { GitHubAppAuth } from 'github-app-auth-kit';

const auth = new GitHubAppAuth({
  appId: process.env.GITHUB_APP_ID!,
  privateKey: process.env.GITHUB_PRIVATE_KEY!,
});

const jwt = auth.createJwt();
```

## Usage

### Client instance (recommended for multiple calls)

```ts
import { GitHubAppAuth } from 'github-app-auth-kit';

const auth = new GitHubAppAuth({
  appId: process.env.GITHUB_APP_ID!,
  privateKey: process.env.GITHUB_PRIVATE_KEY!,
  owner: 'acme',
  repo: 'platform',
});

const installationId = await auth.resolveInstallationId();
const token = await auth.createAccessToken();
```

### Resolve installation id for any repo

```ts
import { GitHubAppAuth } from 'github-app-auth-kit';

const auth = new GitHubAppAuth({
  appId: process.env.GITHUB_APP_ID!,
  privateKey: process.env.GITHUB_PRIVATE_KEY!,
});

const installationId = await auth.resolveInstallationId({
  owner: 'acme',
  repo: 'platform',
});
```

### Create access token with a known installation id

```ts
import { GitHubAppAuth } from 'github-app-auth-kit';

const auth = new GitHubAppAuth({
  appId: process.env.GITHUB_APP_ID!,
  privateKey: process.env.GITHUB_PRIVATE_KEY!,
  installationId: 12345678,
});

const token = await auth.createAccessToken();
```

### One-shot access token

```ts
import { GitHubAppAuth } from 'github-app-auth-kit';

const token = await GitHubAppAuth.createAccessToken({
  appId: process.env.GITHUB_APP_ID!,
  privateKey: process.env.GITHUB_PRIVATE_KEY!,
  installationId: 12345678,
  permissions: {
    contents: 'read',
  },
});
```

### CommonJS usage

```js
const { GitHubAppAuth } = require('github-app-auth-kit');

const auth = new GitHubAppAuth({
  appId: process.env.GITHUB_APP_ID,
  privateKey: process.env.GITHUB_PRIVATE_KEY,
  installationId: 12345678,
});

auth.createAccessToken().then((token) => {
  console.log(token);
});
```

### GitHub Enterprise

```ts
import { GitHubAppAuth } from 'github-app-auth-kit';

const auth = new GitHubAppAuth({
  appId: process.env.GITHUB_APP_ID!,
  privateKey: process.env.GITHUB_PRIVATE_KEY!,
  apiBaseUrl: 'https://github.example.com/api/v3',
  installationId: 12345678,
});

const token = await auth.createAccessToken();
```

### Custom fetch (edge runtimes or Node <18)

```ts
import { GitHubAppAuth } from 'github-app-auth-kit';
import { fetch as undiciFetch } from 'undici';

const auth = new GitHubAppAuth({
  appId: process.env.GITHUB_APP_ID!,
  privateKey: process.env.GITHUB_PRIVATE_KEY!,
  installationId: 12345678,
  fetch: undiciFetch,
});

const token = await auth.createAccessToken();
```

## API

### `new GitHubAppAuth(options)`

| Option           | Type               | Required | Description                                       |
| ---------------- | ------------------ | -------- | ------------------------------------------------- |
| `appId`          | `number \| string` | Yes      | GitHub App id.                                    |
| `privateKey`     | `string`           | Yes      | PEM private key (supports `\n` escaped newlines). |
| `owner`          | `string`           | No       | Default repository owner.                         |
| `repo`           | `string`           | No       | Default repository name.                          |
| `installationId` | `number \| string` | No       | Default installation id for tokens.               |
| `apiBaseUrl`     | `string`           | No       | Override REST API base URL (GitHub Enterprise).   |
| `fetch`          | `typeof fetch`     | No       | Provide `fetch` for non-standard runtimes.        |

### `auth.createJwt()`

Returns a short-lived GitHub App JWT. JWTs are valid for 10 minutes maximum; this library issues 9-minute tokens with a 60-second clock skew.

### `auth.resolveInstallationId({ owner, repo })`

Resolves the installation id for the given repository. Uses the default `owner`/`repo` if set on the constructor.

### `auth.createAccessToken(options)`

Creates an installation access token. You can provide:

- `installationId` to skip repository lookup
- `owner` and `repo` to look up installation id on demand
- optional `permissions`, `repositories`, and `repositoryIds` for fine-grained tokens

### `GitHubAppAuth.createAccessToken(options)`

Convenience one-call helper that creates a client and returns an access token.

## Error handling

All network errors and non-2xx GitHub API responses throw descriptive errors that include the HTTP status and response body.

## Security notes

- Treat `privateKey`, JWTs, and access tokens as secrets.
- Do not log tokens or private keys.
- Issue JWTs only when needed; they expire quickly.

## Runtime support

- Node.js 18+ (native `fetch`)
- Other runtimes: pass a `fetch` implementation in the constructor
- CommonJS consumers can use `require('github-app-auth-kit')`

## Troubleshooting

- If you see "`fetch` is not available in this runtime", pass a `fetch` implementation.
- If you see "Missing repository target", provide both `owner` and `repo`, or use `installationId`.

## Related links

- [GitHub Apps documentation](https://docs.github.com/en/apps/creating-github-apps)
- [GitHub REST API](https://docs.github.com/en/rest)

## License

MIT
