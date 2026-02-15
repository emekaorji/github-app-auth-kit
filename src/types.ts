type PermissionLevel = 'read' | 'write';

export type InstallationTokenPermissions = Record<string, PermissionLevel>;

export type GitHubRepoRef = {
  owner?: string;
  repo?: string;
};

export type CreateAccessTokenOptions = GitHubRepoRef & {
  installationId?: number | string;
  permissions?: InstallationTokenPermissions;
  repositories?: string[];
  repositoryIds?: number[];
};

export type GitHubAppAuthOptions = {
  appId: number | string;
  privateKey: string;
  owner?: string;
  repo?: string;
  installationId?: number | string;
};

export type InstallationIdResponse = {
  id?: number;
};

export type AccessTokenResponse = {
  token?: string;
};
