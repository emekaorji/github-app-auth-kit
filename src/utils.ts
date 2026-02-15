/**
 * Serializes an object to JSON and encodes it in base64url format.
 */
export function toBase64UrlJson(value: Record<string, unknown>): string {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

/**
 * Ensures a required string is present and non-empty after trimming.
 */
export function normalizeRequiredNonEmptyString(
  value: string,
  fieldName: string
): string {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error(`\`${fieldName}\` must be a non-empty string.`);
  }

  return trimmed;
}

/**
 * Normalizes a PEM private key string that may include escaped newlines.
 */
export function normalizePrivateKey(privateKeyRaw: string): string {
  return normalizeRequiredNonEmptyString(privateKeyRaw, 'privateKey').replace(
    /\\n/g,
    '\n'
  );
}

/**
 * Ensures an optional string is non-empty after trimming.
 * Returns `undefined` when the value is not provided.
 */
export function normalizeOptionalNonEmptyString(
  value: string | undefined,
  fieldName: string
): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error(`\`${fieldName}\` must be a non-empty string.`);
  }

  return trimmed;
}

/**
 * Parses and validates a positive integer.
 */
export function parsePositiveInteger(
  value: number | string,
  fieldName: string
): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`\`${fieldName}\` must be a positive integer.`);
  }

  return parsed;
}

/**
 * Parses an optional installation id into a positive integer.
 */
export function parseOptionalInstallationId(
  value: number | string | undefined
): number | undefined {
  if (value === undefined) {
    return undefined;
  }

  return parsePositiveInteger(value, 'installationId');
}

/**
 * Parses an optional JWT expiration window (in seconds).
 * GitHub requires JWTs to expire within 10 minutes.
 */
export function parseOptionalJwtExpiresInSeconds(
  value: number | undefined
): number | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (!Number.isInteger(value) || value <= 0) {
    throw new Error('`jwtExpiresInSeconds` must be a positive integer.');
  }

  if (value > 10 * 60) {
    throw new Error('`jwtExpiresInSeconds` cannot exceed 600 seconds.');
  }

  return value;
}

/**
 * Resolves a fetch implementation, preferring the passed override.
 * Throws a helpful error when fetch is unavailable.
 */
export function resolveFetch(fetcher?: typeof fetch): typeof fetch {
  if (fetcher) {
    return fetcher;
  }

  if (typeof globalThis.fetch !== 'function') {
    throw new Error(
      '`fetch` is not available in this runtime. Provide a fetch implementation in the constructor options.'
    );
  }

  return globalThis.fetch.bind(globalThis);
}

/**
 * Throws a consistent error message for failed GitHub API responses.
 */
export async function throwGitHubApiError(
  response: Response,
  context: string
): Promise<never> {
  const responseBodyRaw = await response.text();
  const responseBody =
    responseBodyRaw.trim().length > 0
      ? responseBodyRaw
      : '(empty response body)';

  throw new Error(
    `${context} (${response.status} ${response.statusText}): ${responseBody}`
  );
}
