# github-app-auth-kit

Simple TypeScript helpers for GitHub App auth:

- create a GitHub App JWT
- resolve installation IDs from `owner/repo`
- mint installation access tokens

The library is intentionally usable in three styles:

1. one-call convenience
2. composable client
3. low-level granular functions

## Install

```bash
pnpm add github-app-auth-kit
```

```ts
import { GitHubAppAuth } from 'github-app-auth-kit';

const auth = new GitHubAppAuth({
  appId: process.env.GITHUB_APP_ID!,
  privateKey: process.env.GITHUB_PRIVATE_KEY!,
});

const jwt = auth.createJwt();
```

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

const token = await auth.createAccessToken({
  owner: 'meoworld',
  repo: 'garfield',
});
```

```ts
import { GitHubAppAuth } from 'github-app-auth-kit';

const auth = new GitHubAppAuth({
  appId: process.env.GITHUB_APP_ID!,
  privateKey: process.env.GITHUB_PRIVATE_KEY!,
  installationId: 12345678
});

const token = await auth.createAccessToken();
```

```ts
const token = await auth.createAccessToken({
  permissions: {
    contents: 'read',
  },
});
```

## Notes

- `privateKey` / `privateKeyRaw` can be passed with escaped newlines (`\\n`).
- Pass `fetch` in options if your runtime does not expose global `fetch`.
