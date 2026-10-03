/**
 * Exact PHP money handling.
 * Amounts are integer centavos inside the server and decimal strings at every boundary,
 * so no amount ever passes through floating-point arithmetic.
 */

export const CURRENCY = 'PHP';
export const MAX_AMOUNT_CENTAVOS = 99_999_999_999; // PHP 999,999,999.99

// Up to nine peso digits keeps every accepted amount within MAX_AMOUNT_CENTAVOS.
const AMOUNT_PATTERN = /^(\d{1,9})(?:\.(\d{1,2}))?$/;

/**
 * Parses a positive decimal string such as "1250.50" into integer centavos.
 * Returns null for anything that is not a positive amount with at most two decimals.
 */
export function parseAmount(text) {
  if (typeof text !== 'string') return null;
  const match = AMOUNT_PATTERN.exec(text.trim());
  if (!match) return null;

  const pesos = Number(match[1]);
  const centavoDigits = (match[2] ?? '').padEnd(2, '0');
  const centavos = pesos * 100 + Number(centavoDigits);
  return centavos > 0 ? centavos : null;
}

/**
 * Formats integer centavos (number, bigint, or integer string) as a decimal string.
 * Negative values are supported for over-budget remainders.
 */
export function formatAmount(centavos) {
  const value = BigInt(centavos);
  const magnitude = value < 0n ? -value : value;
  const sign = value < 0n ? '-' : '';
  return `${sign}${magnitude / 100n}.${String(magnitude % 100n).padStart(2, '0')}`;
}
