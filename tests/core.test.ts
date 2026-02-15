import { describe, expect, it, vi, type MockedFunction } from 'vitest';
import { generateKeyPairSync } from 'node:crypto';

import { GitHubAppAuth } from '../src/core';

type MockResponseOptions = {
  status: number;
  statusText?: string;
  json?: unknown;
  text?: string;
};

const createMockResponse = ({
  status,
  statusText = 'OK',
  json = {},
  text,
}: MockResponseOptions): Response =>
  ({
    ok: status >= 200 && status < 300,
    status,
    statusText,
    json: async () => json,
    text: async () => (text ?? JSON.stringify(json)) || '',
  } as Response);

const createFetchMock = (
  ...responses: Response[]
): MockedFunction<typeof fetch> => {
  let index = 0;
  return vi.fn(async () => {
    const response = responses[index];
    if (!response) {
      throw new Error('No mock response available');
    }
    index += 1;
    return response;
  }) as MockedFunction<typeof fetch>;
};

const createPrivateKey = (): string =>
  generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'pkcs1', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs1', format: 'pem' },
  }).privateKey;

describe('GitHubAppAuth', () => {
  it('creates a JWT with expected header and payload', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-01-01T00:00:00Z'));

    const auth = new GitHubAppAuth({
      appId: 123,
      privateKey: createPrivateKey(),
      fetch: createFetchMock(),
    });

    const jwt = auth.createJwt();
    const [encodedHeader, encodedPayload, signature] = jwt.split('.');

    expect(signature).toBeTruthy();

    const header = JSON.parse(
      Buffer.from(encodedHeader, 'base64url').toString('utf-8')
    );
    const payload = JSON.parse(
      Buffer.from(encodedPayload, 'base64url').toString('utf-8')
    );

    expect(header).toEqual({ alg: 'RS256', typ: 'JWT' });

    const now = Math.floor(Date.now() / 1000);
    expect(payload).toMatchObject({
      iss: 123,
      iat: now - 60,
      exp: now + 9 * 60,
    });

    vi.useRealTimers();
  });

  it('supports configuring JWT expiration', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-01-01T00:00:00Z'));

    const auth = new GitHubAppAuth({
      appId: 123,
      privateKey: createPrivateKey(),
      jwtExpiresInSeconds: 20 * 60,
      fetch: createFetchMock(),
    });

    const jwt = auth.createJwt();
    const [, encodedPayload] = jwt.split('.');

    const payload = JSON.parse(
      Buffer.from(encodedPayload, 'base64url').toString('utf-8')
    );

    const now = Math.floor(Date.now() / 1000);
    expect(payload).toMatchObject({
      iss: 123,
      iat: now - 60,
      exp: now + 20 * 60,
    });

    vi.useRealTimers();
  });

  it('requires owner and repo together when set on the constructor', () => {
    const privateKey = createPrivateKey();

    expect(
      () =>
        new GitHubAppAuth({
          appId: 1,
          privateKey,
          owner: 'octo',
          fetch: createFetchMock(),
        })
    ).toThrow('Both `owner` and `repo` must be provided together');

    expect(
      () =>
        new GitHubAppAuth({
          appId: 1,
          privateKey,
          repo: 'hello',
          fetch: createFetchMock(),
        })
    ).toThrow('Both `owner` and `repo` must be provided together');
  });

  it('resolves installation ids from owner/repo', async () => {
    const fetchMock = createFetchMock(
      createMockResponse({ status: 200, json: { id: 987 } })
    );

    const auth = new GitHubAppAuth({
      appId: 1,
      privateKey: createPrivateKey(),
      owner: 'octo',
      repo: 'hello',
      fetch: fetchMock,
    });

    const id = await auth.resolveInstallationId();
    expect(id).toBe(987);

    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe('https://api.github.com/repos/octo/hello/installation');
    expect(init?.headers).toMatchObject({
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    });
    expect((init?.headers as Record<string, string>)?.Authorization).toMatch(
      /^Bearer .+\..+\..+$/
    );
  });

  it('throws when resolving installation ids without a repo target', async () => {
    const auth = new GitHubAppAuth({
      appId: 1,
      privateKey: createPrivateKey(),
      fetch: createFetchMock(),
    });

    await expect(auth.resolveInstallationId()).rejects.toThrow(
      'Missing repository target.'
    );
  });

  it('surfaces GitHub API errors when resolving installation ids', async () => {
    const fetchMock = createFetchMock(
      createMockResponse({
        status: 404,
        statusText: 'Not Found',
        text: 'No install',
      })
    );

    const auth = new GitHubAppAuth({
      appId: 1,
      privateKey: createPrivateKey(),
      owner: 'octo',
      repo: 'missing',
      fetch: fetchMock,
    });

    await expect(auth.resolveInstallationId()).rejects.toThrow(
      'Failed to read installation for octo/missing (404 Not Found): No install'
    );
  });

  it('throws when installation id responses are missing ids', async () => {
    const fetchMock = createFetchMock(
      createMockResponse({ status: 200, json: {} })
    );

    const auth = new GitHubAppAuth({
      appId: 1,
      privateKey: createPrivateKey(),
      owner: 'octo',
      repo: 'hello',
      fetch: fetchMock,
    });

    await expect(auth.resolveInstallationId()).rejects.toThrow(
      'GitHub response did not include an installation id.'
    );
  });

  it('creates access tokens using a provided installation id without repo info', async () => {
    const fetchMock = createFetchMock(
      createMockResponse({ status: 201, json: { token: 'token-123' } })
    );

    const auth = new GitHubAppAuth({
      appId: 1,
      privateKey: createPrivateKey(),
      installationId: 42,
      fetch: fetchMock,
    });

    const token = await auth.createAccessToken();
    expect(token).toBe('token-123');

    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe(
      'https://api.github.com/app/installations/42/access_tokens'
    );
    expect(init?.method).toBe('POST');
    expect((init?.headers as Record<string, string>)?.Authorization).toMatch(
      /^Bearer .+\..+\..+$/
    );
  });

  it('resolves installation ids when creating access tokens without an explicit id', async () => {
    const fetchMock = createFetchMock(
      createMockResponse({ status: 200, json: { id: 321 } }),
      createMockResponse({ status: 201, json: { token: 'token-xyz' } })
    );

    const auth = new GitHubAppAuth({
      appId: 1,
      privateKey: createPrivateKey(),
      owner: 'octo',
      repo: 'hello',
      fetch: fetchMock,
    });

    const token = await auth.createAccessToken({
      permissions: { contents: 'read' },
      repositories: ['hello'],
      repositoryIds: [101],
    });

    expect(token).toBe('token-xyz');
    expect(fetchMock).toHaveBeenCalledTimes(2);

    const [, init] = fetchMock.mock.calls[1] ?? [];
    const body = JSON.parse((init?.body as string) || '{}');

    expect(body).toEqual({
      permissions: { contents: 'read' },
      repositories: ['hello'],
      repository_ids: [101],
    });
  });

  it('throws when creating access tokens without repo or installation id', async () => {
    const auth = new GitHubAppAuth({
      appId: 1,
      privateKey: createPrivateKey(),
      fetch: createFetchMock(),
    });

    await expect(auth.createAccessToken()).rejects.toThrow(
      'Missing repository target.'
    );
  });

  it('surfaces GitHub API errors when creating access tokens', async () => {
    const fetchMock = createFetchMock(
      createMockResponse({
        status: 403,
        statusText: 'Forbidden',
        text: 'No access',
      })
    );

    const auth = new GitHubAppAuth({
      appId: 1,
      privateKey: createPrivateKey(),
      installationId: 77,
      fetch: fetchMock,
    });

    await expect(auth.createAccessToken()).rejects.toThrow(
      'Failed to create installation access token for installation 77 (403 Forbidden): No access'
    );
  });

  it('throws when access token responses are missing tokens', async () => {
    const fetchMock = createFetchMock(
      createMockResponse({ status: 201, json: {} })
    );

    const auth = new GitHubAppAuth({
      appId: 1,
      privateKey: createPrivateKey(),
      installationId: 77,
      fetch: fetchMock,
    });

    await expect(auth.createAccessToken()).rejects.toThrow(
      'GitHub response did not include an installation token.'
    );
  });

  it('supports the static access token helper', async () => {
    const fetchMock = createFetchMock(
      createMockResponse({ status: 201, json: { token: 'one-shot' } })
    );

    const token = await GitHubAppAuth.createAccessToken({
      appId: 1,
      privateKey: createPrivateKey(),
      installationId: 55,
      fetch: fetchMock,
    });

    expect(token).toBe('one-shot');
  });
});
