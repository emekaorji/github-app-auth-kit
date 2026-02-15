/**
 * Permission level accepted by the GitHub Apps API.
 */
type PermissionLevel = 'read' | 'write';

/**
 * Map of GitHub App permissions for installation access tokens.
 */
export type InstallationTokenPermissions = Record<string, PermissionLevel>;

/**
 * Optional repository target used to resolve installation IDs.
 */
export type GitHubRepoRef = {
  owner?: string;
  repo?: string;
};

/**
 * A minimal fetch signature compatible with `globalThis.fetch`.
 */
export type FetchLike = typeof fetch;

/**
 * Options for creating an installation access token.
 */
export type CreateAccessTokenOptions = GitHubRepoRef & {
  /**
   * Installation id to use directly, skipping repository lookup when provided.
   */
  installationId?: number | string;
  /**
   * Requested permissions scope for the token.
   */
  permissions?: InstallationTokenPermissions;
  /**
   * Restrict the token to specific repository names.
   */
  repositories?: string[];
  /**
   * Restrict the token to specific repository ids.
   */
  repositoryIds?: number[];
};

/**
 * Constructor options for GitHub App authentication.
 */
export type GitHubAppAuthOptions = {
  /**
   * GitHub App id.
   */
  appId: number | string;
  /**
   * PEM-encoded private key for the GitHub App.
   */
  privateKey: string;
  /**
   * Default repository owner.
   */
  owner?: string;
  /**
   * Default repository name.
   */
  repo?: string;
  /**
   * Default installation id to use for access tokens.
   */
  installationId?: number | string;
  /**
   * JWT expiration window in seconds (max 600).
   */
  jwtExpiresInSeconds?: number;
  /**
   * Override the GitHub REST API base URL (useful for GitHub Enterprise).
   */
  apiBaseUrl?: string;
  /**
   * Provide a fetch implementation for runtimes without global fetch.
   */
  fetch?: FetchLike;
};

/**
 * Payload shape returned by the installation lookup endpoint.
 */
export type InstallationIdResponse = {
  id?: number;
};

/**
 * Payload shape returned by the access token endpoint.
 */
export type AccessTokenResponse = {
  token?: string;
};
