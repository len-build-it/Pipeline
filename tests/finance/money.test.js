import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { parseAmount, formatAmount, MAX_AMOUNT_CENTAVOS } from '../../server/finance/money.js';
import { normalizeExpense, normalizeBudget, manilaToday, isCalendarDate } from '../../server/finance/validation.js';

describe('Finance money and validation rules (FEAT-006/REQ-004, REQ-005)', () => {
  describe('parseAmount', () => {
    test('converts decimal strings to exact integer centavos', () => {
      assert.equal(parseAmount('0.01'), 1);
      assert.equal(parseAmount('0.1'), 10);
      assert.equal(parseAmount('1250'), 125000);
      assert.equal(parseAmount('1250.5'), 125050);
      assert.equal(parseAmount(' 19.99 '), 1999);
      assert.equal(parseAmount('999999999.99'), MAX_AMOUNT_CENTAVOS);
    });

    test('sums that break floating point stay exact in centavos', () => {
      assert.equal(parseAmount('0.10') + parseAmount('0.20'), 30);
      assert.equal(formatAmount(parseAmount('0.10') + parseAmount('0.20')), '0.30');
    });

    test('rejects zero, negatives, extra decimals, separators, exponents, and non-strings', () => {
      for (const invalid of ['0', '0.00', '-1', '+1', '1.234', '1,000.00', '1e3', '.5', '5.', '', 'abc', '1000000000', '1000000000.00']) {
        assert.equal(parseAmount(invalid), null, `expected "${invalid}" to be rejected`);
      }
      assert.equal(parseAmount(12.5), null);
      assert.equal(parseAmount(null), null);
      assert.equal(parseAmount(undefined), null);
    });
  });

  describe('formatAmount', () => {
    test('formats numbers, bigints, and integer strings with two decimals', () => {
      assert.equal(formatAmount(5), '0.05');
      assert.equal(formatAmount(100), '1.00');
      assert.equal(formatAmount('99999999999'), '999999999.99');
      assert.equal(formatAmount(12345678901234567890n), '123456789012345678.90');
    });

    test('formats negative remainders', () => {
      assert.equal(formatAmount(-150), '-1.50');
      assert.equal(formatAmount('-5'), '-0.05');
    });
  });

  describe('normalizeExpense', () => {
    const today = '2026-10-03';
    const valid = { occurredOn: '2026-10-03', amount: '10.00', category: 'Supplies', description: 'Markers' };

    test('trims text and turns blank optional fields into null', () => {
      const { value, errors } = normalizeExpense(
        { ...valid, category: '  Supplies  ', description: ' Markers ', vendor: '   ', reference: ' OR-1 ' },
        today
      );
      assert.deepEqual(errors, []);
      assert.deepEqual(value, {
        occurredOn: '2026-10-03',
        amountCentavos: 1000,
        category: 'Supplies',
        description: 'Markers',
        vendor: null,
        reference: 'OR-1',
      });
    });

    test('accepts today and rejects tomorrow', () => {
      assert.deepEqual(normalizeExpense(valid, today).errors, []);
      const fields = normalizeExpense({ ...valid, occurredOn: '2026-10-04' }, today).errors.map(e => e.field);
      assert.deepEqual(fields, ['occurredOn']);
    });

    test('rejects impossible calendar dates', () => {
      assert.equal(isCalendarDate('2026-02-29'), false);
      assert.equal(isCalendarDate('2028-02-29'), true);
      assert.equal(isCalendarDate('2026-13-01'), false);
      assert.equal(isCalendarDate('03/10/2026'), false);
    });

    test('reports every invalid field', () => {
      const { errors } = normalizeExpense(
        { occurredOn: 'yesterday', amount: '1.999', category: 'x'.repeat(61), description: '', vendor: 'v'.repeat(121) },
        today
      );
      assert.deepEqual(errors.map(e => e.field).sort(), ['amount', 'category', 'description', 'occurredOn', 'vendor']);
    });

    test('category boundary: 60 characters accepted, 61 rejected, blank rejected', () => {
      assert.deepEqual(normalizeExpense({ ...valid, category: 'x'.repeat(60) }, today).errors, []);
      assert.equal(normalizeExpense({ ...valid, category: 'x'.repeat(61) }, today).errors.length, 1);
      assert.equal(normalizeExpense({ ...valid, category: '   ' }, today).errors.length, 1);
    });
  });

  describe('normalizeBudget', () => {
    test('accepts a calendar month and rejects other shapes', () => {
      assert.deepEqual(normalizeBudget({ month: '2026-10', category: 'Ops', amount: '500' }).errors, []);
      for (const month of ['2026-13', '2026-00', '2026-1', '2026-10-01', 'October']) {
        assert.equal(normalizeBudget({ month, category: 'Ops', amount: '500' }).errors.length, 1, month);
      }
    });
  });

  test('manilaToday uses the Asia/Manila calendar date', () => {
    // 2026-10-03T16:30Z is already 2026-10-04 00:30 in Manila.
    assert.equal(manilaToday(new Date('2026-10-03T16:30:00Z')), '2026-10-04');
    assert.equal(manilaToday(new Date('2026-10-03T15:59:00Z')), '2026-10-03');
  });
});
