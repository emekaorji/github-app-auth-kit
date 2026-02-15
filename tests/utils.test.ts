import { describe, expect, it } from 'vitest';

import {
  normalizeOptionalNonEmptyString,
  normalizePrivateKey,
  normalizeRequiredNonEmptyString,
  parseOptionalInstallationId,
  parsePositiveInteger,
  resolveFetch,
  throwGitHubApiError,
  toBase64UrlJson,
} from '../src/utils';

describe('utils', () => {
  it('encodes objects as base64url JSON', () => {
    const encoded = toBase64UrlJson({ hello: 'world' });
    const decoded = JSON.parse(
      Buffer.from(encoded, 'base64url').toString('utf-8')
    );
    expect(decoded).toEqual({ hello: 'world' });
  });

  it('normalizes required non-empty strings', () => {
    expect(normalizeRequiredNonEmptyString('  hello  ', 'field')).toBe('hello');
    expect(() => normalizeRequiredNonEmptyString('   ', 'field')).toThrow(
      '`field` must be a non-empty string.'
    );
  });

  it('normalizes optional non-empty strings', () => {
    expect(normalizeOptionalNonEmptyString(undefined, 'field')).toBeUndefined();
    expect(normalizeOptionalNonEmptyString('  ok ', 'field')).toBe('ok');
    expect(() => normalizeOptionalNonEmptyString('  ', 'field')).toThrow(
      '`field` must be a non-empty string.'
    );
  });

  it('normalizes private keys with escaped newlines', () => {
    const input = 'line1\\nline2';
    expect(normalizePrivateKey(input)).toBe('line1\nline2');
  });

  it('throws on invalid private keys', () => {
    expect(() => normalizePrivateKey('   ')).toThrow(
      '`privateKey` must be a non-empty string.'
    );
  });

  it('parses positive integers', () => {
    expect(parsePositiveInteger('42', 'value')).toBe(42);
    expect(parsePositiveInteger(7, 'value')).toBe(7);
    expect(() => parsePositiveInteger('0', 'value')).toThrow(
      '`value` must be a positive integer.'
    );
    expect(() => parsePositiveInteger('-1', 'value')).toThrow(
      '`value` must be a positive integer.'
    );
    expect(() => parsePositiveInteger('1.2', 'value')).toThrow(
      '`value` must be a positive integer.'
    );
    expect(() => parsePositiveInteger('nope', 'value')).toThrow(
      '`value` must be a positive integer.'
    );
  });

  it('parses optional installation ids', () => {
    expect(parseOptionalInstallationId(undefined)).toBeUndefined();
    expect(parseOptionalInstallationId('99')).toBe(99);
  });

  it('resolves fetch implementations', () => {
    const customFetch = (() => Promise.reject(new Error('noop'))) as typeof fetch;
    expect(resolveFetch(customFetch)).toBe(customFetch);
  });

  it('throws helpful errors for GitHub API failures', async () => {
    const response = {
      ok: false,
      status: 403,
      statusText: 'Forbidden',
      json: async () => ({ message: 'Nope' }),
      text: async () => 'Nope',
    } as Response;

    await expect(
      throwGitHubApiError(response, 'Failed to test')
    ).rejects.toThrow('Failed to test (403 Forbidden): Nope');
  });
});
