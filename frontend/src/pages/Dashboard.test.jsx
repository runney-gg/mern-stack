// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import Dashboard from './Dashboard.jsx';
import {
  createTransaction,
  deleteTransaction,
  getHealth,
  getSummary,
  getTransactionsPage,
  updateTransaction,
} from '../api/transactions.js';

vi.mock('../api/transactions.js', () => ({
  createTransaction: vi.fn(),
  deleteTransaction: vi.fn(),
  getHealth: vi.fn(),
  getSummary: vi.fn(),
  getTransactionsPage: vi.fn(),
  updateTransaction: vi.fn(),
}));

vi.mock('../components/FinanceCharts.jsx', () => ({
  MonthlyChart: () => null,
  CategoryChart: () => null,
}));

let records;
let nextId;

function thisMonth(date) {
  return date.slice(0, 7);
}

function buildSummary(month) {
  const transactions = month
    ? records.filter((transaction) => thisMonth(transaction.date) === month)
    : records;
  const totalIncome = transactions
    .filter((transaction) => transaction.type === 'income')
    .reduce((sum, transaction) => sum + transaction.amount, 0);
  const expenseTransactions = transactions.filter((transaction) => transaction.type === 'expense');
  const totalExpenses = expenseTransactions.reduce((sum, transaction) => sum + transaction.amount, 0);
  const categoryTotals = new Map();
  expenseTransactions.forEach(({ category, amount }) => {
    categoryTotals.set(category, (categoryTotals.get(category) || 0) + amount);
  });

  return {
    totalIncome,
    totalExpenses,
    balance: totalIncome - totalExpenses,
    expensesByCategory: [...categoryTotals].map(([category, total]) => ({ category, total })),
    monthlyData: [],
  };
}

function cardText(label) {
  return screen.getByText(label).closest('article').textContent;
}

beforeEach(() => {
  const today = new Date().toISOString().slice(0, 10);
  records = [{
    _id: 'salary-1',
    type: 'income',
    amount: 40,
    category: 'Salary',
    description: 'Part-time work',
    date: `${today}T00:00:00.000Z`,
  }];
  nextId = 1;

  getHealth.mockResolvedValue({ database: 'connected' });
  getTransactionsPage.mockImplementation(async (_filters = {}, pagination = {}) => ({
    transactions: records.slice(0, pagination.limit || 20),
    pagination: {
      page: pagination.page || 1,
      limit: pagination.limit || 20,
      total: records.length,
      totalPages: records.length ? 1 : 0,
    },
  }));
  getSummary.mockImplementation(async ({ month } = {}) => buildSummary(month));
  createTransaction.mockImplementation(async (payload) => {
    const transaction = { _id: `new-${nextId++}`, ...payload };
    records = [...records, transaction];
    return transaction;
  });
  updateTransaction.mockImplementation(async (id, updates) => {
    records = records.map((transaction) => transaction._id === id ? { ...transaction, ...updates } : transaction);
    return records.find((transaction) => transaction._id === id);
  });
  deleteTransaction.mockImplementation(async (id) => {
    records = records.filter((transaction) => transaction._id !== id);
    return { message: 'Transaction deleted.' };
  });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

it('refreshes dashboard summaries and recent transactions after create, update, and delete', async () => {
  vi.spyOn(window, 'confirm').mockReturnValue(true);
  render(<Dashboard />);

  await screen.findByRole('button', { name: 'Edit Part-time work' });
  expect(cardText('Total income')).toContain('40.00');

  fireEvent.click(screen.getByRole('button', { name: /Add transaction/ }));
  fireEvent.change(screen.getByLabelText(/Amount/), { target: { value: '12.50' } });
  fireEvent.change(screen.getByLabelText(/^Category/), { target: { value: 'Food' } });
  fireEvent.change(screen.getByLabelText(/Description/), { target: { value: 'Lunch' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save transaction' }));

  await screen.findByRole('button', { name: 'Edit Lunch' });
  await waitFor(() => expect(cardText('Total expenses')).toContain('12.50'));
  expect(createTransaction).toHaveBeenCalledWith(expect.objectContaining({ amount: 12.5, category: 'Food', description: 'Lunch' }));

  fireEvent.click(screen.getByRole('button', { name: 'Edit Part-time work' }));
  fireEvent.change(screen.getByLabelText(/Amount/), { target: { value: '60.00' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

  await waitFor(() => expect(cardText('Total income')).toContain('60.00'));
  expect(updateTransaction).toHaveBeenCalledWith('salary-1', expect.objectContaining({ amount: 60 }));

  fireEvent.click(screen.getByRole('button', { name: 'Delete Lunch' }));
  await waitFor(() => expect(screen.queryByRole('button', { name: 'Edit Lunch' })).toBeNull());
  await waitFor(() => expect(cardText('Total expenses')).toContain('0.00'));
  expect(deleteTransaction).toHaveBeenCalledWith(expect.stringMatching(/^new-/));
  expect(getTransactionsPage).toHaveBeenCalledTimes(4);
  expect(getSummary).toHaveBeenCalledTimes(8);
});

it('sends search and filters to the API and presents filtered-load errors', async () => {
  getTransactionsPage.mockImplementation(async (filters = {}, pagination = {}) => {
    if (filters.search === 'offline') throw new Error('Filtered transactions could not be loaded.');
    return {
      transactions: records.slice(0, pagination.limit || 20),
      pagination: {
        page: pagination.page || 1,
        limit: pagination.limit || 20,
        total: records.length,
        totalPages: records.length ? 1 : 0,
      },
    };
  });
  render(<Dashboard />);

  fireEvent.click(screen.getByRole('button', { name: /Transactions/ }));
  fireEvent.change(screen.getByRole('searchbox', { name: 'Search transactions' }), { target: { value: 'work' } });
  fireEvent.change(screen.getByLabelText('Filter by month'), { target: { value: '2026-11' } });
  fireEvent.change(screen.getByRole('combobox', { name: 'Filter by transaction type' }), { target: { value: 'income' } });

  await waitFor(() => expect(getTransactionsPage).toHaveBeenCalledWith(
    expect.objectContaining({ search: 'work', month: '2026-11', type: 'income' }),
    expect.objectContaining({ page: 1, limit: 20 }),
  ));

  fireEvent.change(screen.getByRole('searchbox', { name: 'Search transactions' }), { target: { value: 'offline' } });
  await screen.findByText('Filtered transactions could not be loaded.', {}, { timeout: 2500 });
  expect(screen.getByText('Could not load transactions. Use the error notice above to retry.')).toBeTruthy();
});

it('clears the API error notice after retry succeeds', async () => {
  getHealth.mockRejectedValueOnce(new Error('Cannot reach the SpendWise API.'));
  render(<Dashboard />);

  await screen.findByText('Cannot reach the SpendWise API.');
  fireEvent.click(screen.getByRole('button', { name: 'Retry' }));

  await waitFor(() => expect(screen.queryByText('Cannot reach the SpendWise API.')).toBeNull());
  expect(getHealth).toHaveBeenCalledTimes(2);
});
