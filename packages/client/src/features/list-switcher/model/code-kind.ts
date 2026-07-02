export type CodeKind = 'list' | 'device' | 'invalid';

// ponytail: 6/8 are today's `newCode()` lengths in `lists/routes.ts` /
// `link/routes.ts`, not a protocol contract — update here if they change.
export function codeKind(code: string): CodeKind {
  if (code.length === 8) return 'list';
  if (code.length === 6) return 'device';
  return 'invalid';
}
