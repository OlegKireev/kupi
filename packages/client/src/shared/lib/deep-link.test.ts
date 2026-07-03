import { expect, test } from 'vitest';

import { parseDeepLink } from './deep-link';

test('parses a list invite code', () => {
  expect(parseDeepLink('?listCode=A1B2C3D4')).toEqual({
    kind: 'list',
    code: 'A1B2C3D4',
  });
});

test('parses a device link code', () => {
  expect(parseDeepLink('?deviceCode=A1B2C3')).toEqual({
    kind: 'device',
    code: 'A1B2C3',
  });
});

test('prefers listCode when both params are present', () => {
  expect(parseDeepLink('?listCode=A1B2C3D4&deviceCode=A1B2C3')).toEqual({
    kind: 'list',
    code: 'A1B2C3D4',
  });
});

test('returns null when neither param is present', () => {
  expect(parseDeepLink('')).toBeNull();
});

test('returns null for an empty listCode value', () => {
  expect(parseDeepLink('?listCode=')).toBeNull();
});

test('returns null for an empty deviceCode value', () => {
  expect(parseDeepLink('?deviceCode=')).toBeNull();
});
