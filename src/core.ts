import crypto from 'node:crypto';

import {
  toBase64UrlJson,
  normalizePrivateKey,
  normalizeOptionalNonEmptyString,
  parsePositiveInteger,
  parseOptionalInstallationId,
  parseOptionalJwtExpiresInSeconds,
  resolveFetch,
  throwGitHubApiError,
} from './utils';
import type {
  GitHubAppAuthOptions,
  GitHubRepoRef,
  InstallationIdResponse,
  AccessTokenResponse,
  CreateAccessTokenOptions,
  FetchLike,
} from './types';

/**
 * Default GitHub REST API base URL.
 */
const DEFAULT_GITHUB_API_BASE_URL = 'https://api.github.com';
const DEFAULT_JWT_EXPIRES_IN_SECONDS = 9 * 60;

/**
 * GitHub App authentication helper for creating JWTs and installation tokens.
 */
export class GitHubAppAuth {
  /**
   * Numeric GitHub App id.
   */
  private readonly appId: number;
  /**
   * Normalized PEM private key for signing JWTs.
   */
  private readonly privateKey: string;
  /**
   * Default repository owner.
   */
  private readonly owner: string | undefined;
  /**
   * Default repository name.
   */
  private readonly repo: string | undefined;
  /**
   * Default installation id.
   */
  private readonly installationId: number | undefined;
  /**
   * Base URL for the GitHub REST API. Defaults to `https://api.github.com`.
   */
  private readonly apiBaseUrl: string;
  /**
   * JWT expiration window in seconds.
   */
  private readonly jwtExpiresInSeconds: number;
  /**
   * Fetch implementation to use for API calls.
   */
  private readonly fetcher: FetchLike;

  /**
   * Creates a new GitHub App authentication client.
   */
  constructor({
    appId,
    privateKey,
    owner,
    repo,
    installationId,
    jwtExpiresInSeconds,
    apiBaseUrl,
    fetch,
  }: GitHubAppAuthOptions) {
    this.appId = parsePositiveInteger(appId, 'appId');
    this.privateKey = normalizePrivateKey(privateKey);
    this.owner = normalizeOptionalNonEmptyString(owner, 'owner');
    this.repo = normalizeOptionalNonEmptyString(repo, 'repo');
    this.installationId = parseOptionalInstallationId(installationId);
    this.jwtExpiresInSeconds =
      parseOptionalJwtExpiresInSeconds(jwtExpiresInSeconds) ??
      DEFAULT_JWT_EXPIRES_IN_SECONDS;
    this.apiBaseUrl =
      normalizeOptionalNonEmptyString(apiBaseUrl, 'apiBaseUrl') ??
      DEFAULT_GITHUB_API_BASE_URL;
    this.apiBaseUrl = this.apiBaseUrl.replace(/\/+$/, '');
    this.fetcher = resolveFetch(fetch);

    if ((this.owner && !this.repo) || (!this.owner && this.repo)) {
      throw new Error(
        'Both `owner` and `repo` must be provided together when setting a default repository target.'
      );
    }
  }

  /**
   * Creates a short-lived GitHub App JWT.
   */
  createJwt(): string {
    const now = Math.floor(Date.now() / 1000);
    const payload = {
      iat: now - 60,
      exp: now + this.jwtExpiresInSeconds,
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

  /**
   * Resolves the installation id for a repository.
   */
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

    const appJwt = this.createJwt();
    let response: Response;
    try {
      response = await this.fetcher(
        `${this.apiBaseUrl}/repos/${_owner}/${_repo}/installation`,
        {
          headers: {
            Accept: 'application/vnd.github+json',
            Authorization: `Bearer ${appJwt}`,
            'X-GitHub-Api-Version': '2022-11-28',
          },
        }
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(
        `Failed to read installation for ${_owner}/${_repo}: ${message}`
      );
    }

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

  /**
   * Creates an installation access token.
   */
  async createAccessToken({
    owner,
    repo,
    installationId,
    permissions,
    repositories,
    repositoryIds,
  }: CreateAccessTokenOptions = {}): Promise<string> {
    let _installationId = parseOptionalInstallationId(
      installationId ?? this.installationId
    );

    if (!_installationId) {
      const _owner = owner ?? this.owner;
      const _repo = repo ?? this.repo;

      if (!_owner || !_repo) {
        throw new Error(
          'Missing repository target. Provide both `owner` and `repo` in the constructor or method call.'
        );
      }

      _installationId = await this.resolveInstallationId({
        owner: _owner,
        repo: _repo,
      });
    }

    const body = JSON.stringify({
      permissions,
      repositories,
      repository_ids: repositoryIds,
    });
    const headers: Record<string, string> = {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${this.createJwt()}`,
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
    };

    let response: Response;
    try {
      response = await this.fetcher(
        `${this.apiBaseUrl}/app/installations/${_installationId}/access_tokens`,
        {
          method: 'POST',
          headers,
          body,
        }
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(
        `Failed to create installation access token for installation ${_installationId}: ${message}`
      );
    }

    if (!response.ok) {
      return throwGitHubApiError(
        response,
        `Failed to create installation access token for installation ${_installationId}`
      );
    }

    const payload = (await response.json()) as AccessTokenResponse;
    if (!payload.token) {
      throw new Error('GitHub response did not include an installation token.');
    }

    return payload.token;
  }

  /**
   * Convenience one-call API for creating installation access tokens.
   */
  static async createAccessToken(
    options: GitHubAppAuthOptions & CreateAccessTokenOptions
  ): Promise<string> {
    const auth = new GitHubAppAuth(options);
    return auth.createAccessToken(options);
  }
}
