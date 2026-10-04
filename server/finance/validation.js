/**
 * Finance input rules shared by the API and by spreadsheet import rows.
 * Each normalizer returns { value, errors } so callers can either reject a request
 * or report row-level problems without committing anything.
 */

import { parseAmount } from './money.js';

export const CATEGORY_MAX_LENGTH = 60;
export const DESCRIPTION_MAX_LENGTH = 500;
export const OPTIONAL_TEXT_MAX_LENGTH = 120;

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const MONTH_PATTERN = /^(\d{4})-(\d{2})$/;

const manilaDateFormat = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Manila',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** Current calendar date in Asia/Manila as YYYY-MM-DD. */
export function manilaToday(now = new Date()) {
  return manilaDateFormat.format(now);
}

export function isCalendarDate(text) {
  const match = typeof text === 'string' ? DATE_PATTERN.exec(text) : null;
  if (!match) return false;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

export function isCalendarMonth(text) {
  const match = typeof text === 'string' ? MONTH_PATTERN.exec(text) : null;
  return Boolean(match) && Number(match[2]) >= 1 && Number(match[2]) <= 12;
}

function trimmed(value) {
  return value === undefined || value === null ? '' : String(value).trim();
}

function optionalText(value, field, label, errors) {
  const text = trimmed(value);
  if (text.length > OPTIONAL_TEXT_MAX_LENGTH) {
    errors.push({ field, message: `${label} must be at most ${OPTIONAL_TEXT_MAX_LENGTH} characters.` });
  }
  return text === '' ? null : text;
}

function categoryText(value, errors) {
  const category = trimmed(value);
  if (category.length < 1 || category.length > CATEGORY_MAX_LENGTH) {
    errors.push({ field: 'category', message: `Category must be 1 to ${CATEGORY_MAX_LENGTH} characters.` });
  }
  return category;
}

function amountCentavos(value, errors) {
  const centavos = parseAmount(value);
  if (centavos === null) {
    errors.push({
      field: 'amount',
      message: 'Amount must be a positive PHP value with at most two decimals, up to 999999999.99.',
    });
  }
  return centavos;
}

/**
 * Normalizes an expense: occurredOn, amount (decimal string), category, description,
 * and optional vendor and reference. `today` is the Manila date used for the future-date rule.
 */
export function normalizeExpense(input, today = manilaToday()) {
  const errors = [];

  const occurredOn = trimmed(input.occurredOn);
  if (!isCalendarDate(occurredOn)) {
    errors.push({ field: 'occurredOn', message: 'Date must be a valid calendar date in YYYY-MM-DD format.' });
  } else if (occurredOn > today) {
    errors.push({ field: 'occurredOn', message: 'Date cannot be in the future.' });
  }

  const description = trimmed(input.description);
  if (description.length < 1 || description.length > DESCRIPTION_MAX_LENGTH) {
    errors.push({ field: 'description', message: `Description must be 1 to ${DESCRIPTION_MAX_LENGTH} characters.` });
  }

  const value = {
    occurredOn,
    amountCentavos: amountCentavos(input.amount, errors),
    category: categoryText(input.category, errors),
    description,
    vendor: optionalText(input.vendor, 'vendor', 'Vendor', errors),
    reference: optionalText(input.reference, 'reference', 'Reference', errors),
  };

  return { value, errors };
}

/** Normalizes a budget: month (YYYY-MM), category, and amount (decimal string). */
export function normalizeBudget(input) {
  const errors = [];

  const month = trimmed(input.month);
  if (!isCalendarMonth(month)) {
    errors.push({ field: 'month', message: 'Month must be in YYYY-MM format.' });
  }

  const value = {
    month,
    category: categoryText(input.category, errors),
    amountCentavos: amountCentavos(input.amount, errors),
  };

  return { value, errors };
}
