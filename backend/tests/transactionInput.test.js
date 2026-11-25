import test from 'node:test';
import assert from 'node:assert/strict';
import Transaction from '../src/models/Transaction.js';
import { buildTransactionFilter } from '../src/utils/transactionFilters.js';
import { parseTransactionInput } from '../src/utils/transactionInput.js';

test('parses a valid transaction and trims text fields', () => {
  const transaction = parseTransactionInput({
    type: 'expense',
    amount: '125.5',
    category: ' Food ',
    description: ' Lunch ',
    date: '2026-11-09',
  });

  assert.equal(transaction.type, 'expense');
  assert.equal(transaction.amount, 125.5);
  assert.equal(transaction.category, 'Food');
  assert.equal(transaction.description, 'Lunch');
  assert.equal(transaction.date.toISOString(), '2026-11-09T00:00:00.000Z');
});

test('rejects missing required fields, invalid type, and non-positive amount', () => {
  assert.throws(() => parseTransactionInput({ type: 'income' }), /Amount is required/);
  assert.throws(() => parseTransactionInput({ type: 'transfer', amount: 10, category: 'Other', date: '2026-01-01' }), /Type must be either/);
  assert.throws(() => parseTransactionInput({ type: 'income', amount: 0, category: 'Work', date: '2026-01-01' }), /between 0.01/);
  assert.throws(() => parseTransactionInput({ type: 'income', amount: true, category: 'Work', date: '2026-01-01' }), /two decimal places/);
  assert.throws(() => parseTransactionInput({ type: 'income', amount: 1, category: 'Work', date: '2026-02-30' }), /valid calendar date/);
});

test('enforces amount bounds, cent precision, and transaction text limits', () => {
  const base = { type: 'expense', amount: 1.25, category: 'Food', date: '2026-01-01' };
  assert.equal(parseTransactionInput({ ...base, amount: '0.01' }).amount, 0.01);
  assert.equal(parseTransactionInput({ ...base, amount: 1_000_000_000 }).amount, 1_000_000_000);
  assert.throws(() => parseTransactionInput({ ...base, amount: 1_000_000_000.01 }), /between 0.01/);
  assert.throws(() => parseTransactionInput({ ...base, amount: 1.239 }), /two decimal places/);
  assert.throws(() => parseTransactionInput({ ...base, amount: '1.239' }), /two decimal places/);
  assert.throws(() => parseTransactionInput({ ...base, category: 'x'.repeat(101) }), /Category cannot exceed 100/);
  assert.throws(() => parseTransactionInput({ ...base, description: 'x'.repeat(501) }), /Description cannot exceed 500/);
  assert.throws(() => parseTransactionInput({ description: 'x'.repeat(501) }, { partial: true }), /Description cannot exceed 500/);
});

test('supports partial updates and clearing an optional description', () => {
  assert.deepEqual(parseTransactionInput({ amount: '25' }, { partial: true }), { amount: 25 });
  assert.deepEqual(parseTransactionInput({ description: '' }, { partial: true }), { description: '' });
  assert.throws(() => parseTransactionInput({ amount: '' }, { partial: true }), /Amount is required/);
});

test('validates model fields and defines timestamps', () => {
  const invalid = new Transaction({ type: 'transfer', amount: 1.239, category: '', date: 'invalid' });
  const error = invalid.validateSync();

  assert.ok(error);
  assert.ok(error.errors.type);
  assert.match(error.errors.amount.message, /two decimal places/);
  assert.ok(error.errors.category);
  assert.ok(error.errors.date);

  const belowMinimum = new Transaction({ type: 'expense', amount: -1, category: 'Food', date: new Date() });
  assert.ok(belowMinimum.validateSync().errors.amount);

  const valid = new Transaction({ type: 'income', amount: 100, category: 'Salary', date: new Date() });
  assert.equal(valid.validateSync(), undefined);
  assert.ok(Transaction.schema.path('createdAt'));
  assert.ok(Transaction.schema.path('updatedAt'));
});

test('builds combined month, type, and escaped search filters', () => {
  const filter = buildTransactionFilter({ month: '2026-11', type: 'expense', search: 'food+' });

  assert.equal(filter.type, 'expense');
  assert.equal(filter.date.$gte.toISOString(), '2026-11-01T00:00:00.000Z');
  assert.equal(filter.date.$lt.toISOString(), '2026-12-01T00:00:00.000Z');
  assert.equal(filter.$or[0].category.test('FOOD+'), true);
  assert.equal(filter.$or[0].category.test('fooddd'), false);
});

test('treats endDate as inclusive and rejects invalid or empty ranges', () => {
  const filter = buildTransactionFilter({ startDate: '2026-11-01', endDate: '2026-11-09' });
  assert.equal(filter.date.$lt.toISOString(), '2026-11-10T00:00:00.000Z');

  assert.throws(() => buildTransactionFilter({ month: '2026-13' }), /YYYY-MM/);
  assert.throws(() => buildTransactionFilter({ startDate: '2026-02-30' }), /valid calendar date/);
  assert.throws(() => buildTransactionFilter({ month: '2026-11', startDate: '2026-12-01' }), /date range is empty/);
});

test('limits category and search filter lengths', () => {
  assert.equal(buildTransactionFilter({ category: 'x'.repeat(100) }).category instanceof RegExp, true);
  assert.throws(() => buildTransactionFilter({ category: 'x'.repeat(101) }), /Category filter cannot exceed 100/);
  assert.throws(() => buildTransactionFilter({ search: 'x'.repeat(101) }), /Search cannot exceed 100/);
});
