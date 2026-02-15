import crypto from 'node:crypto';

import {
  toBase64UrlJson,
  normalizePrivateKey,
  normalizeOptionalNonEmptyString,
  parsePositiveInteger,
  parseOptionalInstallationId,
  throwGitHubApiError,
} from './utils';
import type {
  GitHubAppAuthOptions,
  GitHubRepoRef,
  InstallationIdResponse,
  AccessTokenResponse,
  CreateAccessTokenOptions,
} from './types';

const DEFAULT_GITHUB_API_BASE_URL = 'https://api.github.com';

export class GitHubAppAuth {
  private readonly appId: number;
  private readonly privateKey: string;
  private readonly owner: string | undefined;
  private readonly repo: string | undefined;
  private readonly installationId: number | string | undefined;

  private readonly appJwt = this.createJwt();

  constructor({
    appId,
    privateKey,
    owner,
    repo,
    installationId,
  }: GitHubAppAuthOptions) {
    this.appId = parsePositiveInteger(appId, 'appId');
    this.privateKey = normalizePrivateKey(privateKey);
    this.owner = normalizeOptionalNonEmptyString(owner, 'owner');
    this.repo = normalizeOptionalNonEmptyString(repo, 'repo');
    this.installationId = parseOptionalInstallationId(installationId);

    if ((this.owner && !this.repo) || (!this.owner && this.repo)) {
      throw new Error(
        'Both `owner` and `repo` must be provided together when setting a default repository target.'
      );
    }
  }

  createJwt(): string {
    const now = Math.floor(Date.now() / 1000);
    const payload = {
      iat: now - 60,
      exp: now + 9 * 60,
      iss: this.appId,
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

    const signature = signer.sign(this.privateKey, 'base64url');
    return `${signingInput}.${signature}`;
  }

  async resolveInstallationId({
    owner,
    repo,
  }: GitHubRepoRef = {}): Promise<number> {
    const _owner = owner ?? this.owner;
    const _repo = repo ?? this.repo;

    if (!_owner || !_repo) {
      throw new Error(
        'Missing repository target. Provide both `owner` and `repo` in the constructor or method call.'
      );
    }

    const response = await fetch(
      `${DEFAULT_GITHUB_API_BASE_URL}/repos/${_owner}/${_repo}/installation`,
      {
        headers: {
          Accept: 'application/vnd.github+json',
          Authorization: `Bearer ${this.appJwt}`,
        },
      }
    );

    if (!response.ok) {
      return throwGitHubApiError(
        response,
        `Failed to read installation for ${_owner}/${_repo}`
      );
    }

    const payload = (await response.json()) as InstallationIdResponse;
    if (!payload.id) {
      throw new Error('GitHub response did not include an installation id.');
    }

    return payload.id;
  }

  async createAccessToken({
    owner,
    repo,
    installationId,
    permissions,
    repositories,
    repositoryIds,
  }: CreateAccessTokenOptions = {}): Promise<string> {
    const _owner = owner ?? this.owner;
    const _repo = repo ?? this.repo;

    if (!_owner || !_repo) {
      throw new Error(
        'Missing repository target. Provide both `owner` and `repo` in the constructor or method call.'
      );
    }

    const _installationId = parseOptionalInstallationId(
      installationId ||
        this.installationId ||
        (await this.resolveInstallationId({ owner: _owner, repo: _repo }))
    );

    const body = JSON.stringify({
      permissions,
      repositories,
      repository_ids: repositoryIds,
    });
    const headers: Record<string, string> = {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${this.appJwt}`,
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
    };

    const response = await fetch(
      `${DEFAULT_GITHUB_API_BASE_URL}/app/installations/${_installationId}/access_tokens`,
      {
        method: 'POST',
        headers,
        body,
      }
    );

    if (!response.ok) {
      return throwGitHubApiError(
        response,
        `Failed to create installation access token for installation ${installationId}`
      );
    }

    const payload = (await response.json()) as AccessTokenResponse;
    if (!payload.token) {
      throw new Error('GitHub response did not include an installation token.');
    }

    return payload.token;
  }

  static async createAccessToken(
    options: GitHubAppAuthOptions & CreateAccessTokenOptions
  ): Promise<string> {
    const auth = new GitHubAppAuth(options);
    return auth.createAccessToken(options);
  }
}
