export function toBase64UrlJson(value: Record<string, unknown>): string {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

export function normalizePrivateKey(privateKeyRaw: string): string {
  return privateKeyRaw.replace(/\\n/g, '\n');
}

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

export function parseOptionalInstallationId(
  value: number | string | undefined
): number | undefined {
  if (value === undefined) {
    return undefined;
  }

  return parsePositiveInteger(value, 'installationId');
}

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
