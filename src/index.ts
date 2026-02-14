import crypto from 'node:crypto';

import { toBase64UrlJson } from './utils';

const GITHUB_API_BASE_URL = 'https://api.github.com';

export function generateGitHubAppJwt(
  appId: number,
  privateKeyRaw: string
): string {
  const privateKey = privateKeyRaw.replace(/\\n/g, '\n');

  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iat: now - 60,
    exp: now + 9 * 60,
    iss: appId,
  };

  const header = {
    alg: 'RS256',
    typ: 'JWT',
  };

  const encodedHeader = toBase64UrlJson(header);
  const encodedPayload = toBase64UrlJson(payload);
  const signingInput = `${encodedHeader}.${encodedPayload}`;

  const signer = crypto.createSign('RSA-SHA256');
  signer.update(signingInput);
  signer.end();

  const signature = signer.sign(privateKey, 'base64url');
  return `${signingInput}.${signature}`;
}

export async function resolveAppInstallationId({
  owner,
  repo,
  appId,
  privateKeyRaw,
}: {
  owner: string;
  repo: string;
  appId: number;
  privateKeyRaw: string;
}): Promise<number> {
  const appJwt = generateGitHubAppJwt(appId, privateKeyRaw);
  const encodedOwner = encodeURIComponent(owner);
  const encodedRepo = encodeURIComponent(repo);
  const response = await fetch(
    `${GITHUB_API_BASE_URL}/repos/${encodedOwner}/${encodedRepo}/installation`,
    {
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${appJwt}`,
      },
    }
  );

  if (!response.ok) {
    const message = await response.text();
    throw new Error(
      `Failed to read installation for ${owner}/${repo} (${response.status}): ${message}`
    );
  }

  const payload = (await response.json()) as { id?: number };
  if (!payload?.id) {
    throw new Error('GitHub response did not include an installation id.');
  }

  return payload.id;
}

export async function createAppInstallationAccessToken({
  owner,
  repo,
  appId,
  privateKeyRaw,
}: {
  owner: string;
  repo: string;
  appId: number;
  privateKeyRaw: string;
}): Promise<string> {
  const appJwt = generateGitHubAppJwt(appId, privateKeyRaw);
  const appInstallationId = await resolveAppInstallationId({
    owner,
    repo,
    appId,
    privateKeyRaw,
  });

  const response = await fetch(
    `${GITHUB_API_BASE_URL}/app/installations/${appInstallationId}/access_tokens`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${appJwt}`,
        'Content-Type': 'application/json',
      },
    }
  );

  if (!response.ok) {
    throw new Error(
      `Failed to create installation access token: ${response.statusText}`
    );
  }

  const data = await response.json();

  return data.token;
}
