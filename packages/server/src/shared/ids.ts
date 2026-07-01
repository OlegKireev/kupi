import { randomUUID, randomBytes } from 'node:crypto';

/** Генерирует новый UUID */
export const newId = (): string => randomUUID();

/** Генерирует новый стойкий токен (32 байта в base64url) */
export const newToken = (): string => randomBytes(32).toString('base64url');

// Алфавит без 0/O/1/I — чтобы код можно было читать вслух без путаницы
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/**
 * Генерирует случайный буквенно-цифровой код заданной длины.
 * По умолчанию 6 символов (для invite/link кодов).
 */
export function newCode(length = 6): string {
  const bytes = randomBytes(length);
  let result = '';
  for (let i = 0; i < length; i++) {
    // На 32-символьном алфавите modulo-bias пренебрежимо мал
    result += ALPHABET[bytes[i]! % ALPHABET.length];
  }
  return result;
}

/**
 * Нормализует название для поиска и подсказок:
 * обрезает пробелы и приводит в нижний регистр.
 */
export const normalizeName = (name: string): string =>
  name.trim().toLowerCase();
