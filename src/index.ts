import crypto from 'node:crypto';

import { toBase64UrlJson } from './utils';

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

export async function createInstallationToken(
  appId: number,
  privateKeyRaw: string,
  appInstallationId: string
): Promise<string> {
  const appJwt = generateGitHubAppJwt(appId, privateKeyRaw);

  const response = await fetch(
    `https://api.github.com/app/installations/${appInstallationId}/access_tokens`,
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
