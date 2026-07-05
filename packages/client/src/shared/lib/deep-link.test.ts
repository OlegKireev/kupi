import { describe, expect, it } from 'vitest';

import { parseDeepLink } from './deep-link';

describe('parseDeepLink()', () => {
  it('parses a list invite code', () => {
    expect(parseDeepLink('?listCode=A1B2C3D4')).toStrictEqual({
      code: 'A1B2C3D4',
      kind: 'list',
    });
  });

  it('parses a device link code', () => {
    expect(parseDeepLink('?deviceCode=A1B2C3')).toStrictEqual({
      code: 'A1B2C3',
      kind: 'device',
    });
  });

  it('prefers listCode when both params are present', () => {
    expect(
      parseDeepLink('?listCode=A1B2C3D4&deviceCode=A1B2C3'),
    ).toStrictEqual({
      code: 'A1B2C3D4',
      kind: 'list',
    });
  });

  it('returns null when neither param is present', () => {
    expect(parseDeepLink('')).toBeNull();
  });

  it('returns null for an empty listCode value', () => {
    expect(parseDeepLink('?listCode=')).toBeNull();
  });

  it('returns null for an empty deviceCode value', () => {
    expect(parseDeepLink('?deviceCode=')).toBeNull();
  });
});
