import { expect, test } from 'vitest';

import { codeKind } from './code-kind';

test('8-character code is a list invite', () => {
  expect(codeKind('ABCD1234')).toBe('list');
});

test('6-character code is a device link code', () => {
  expect(codeKind('ABC123')).toBe('device');
});

test('any other length is invalid', () => {
  expect(codeKind('')).toBe('invalid');
  expect(codeKind('ABC12')).toBe('invalid');
  expect(codeKind('ABCD12345')).toBe('invalid');
});
