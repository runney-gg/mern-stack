import Transaction from '../models/Transaction.js';
import ApiError from '../utils/ApiError.js';
import { buildTransactionFilter } from '../utils/transactionFilters.js';
import { parseTransactionInput } from '../utils/transactionInput.js';

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_PAGE = 10_000;
const MAX_LIMIT = 100;

function roundToCents(amount) {
  return Math.round(amount * 100) / 100;
}

function parsePositiveInteger(value, field, fallback) {
  if (value === undefined) return fallback;
  if (typeof value !== 'string' || !/^\d+$/.test(value)) {
    throw new ApiError(400, `${field} must be a positive integer.`);
  }

  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    throw new ApiError(400, `${field} must be a positive integer.`);
  }
  return parsed;
}

export async function listTransactions(request, response) {
  const filter = buildTransactionFilter(request.query);
  const requestedPage = parsePositiveInteger(request.query.page, 'page', DEFAULT_PAGE);
  const limit = Math.min(parsePositiveInteger(request.query.limit, 'limit', DEFAULT_LIMIT), MAX_LIMIT);
  if (requestedPage > MAX_PAGE) {
    throw new ApiError(400, `page cannot exceed ${MAX_PAGE}.`);
  }

  const total = await Transaction.countDocuments(filter);
  const totalPages = Math.ceil(total / limit);
  const page = totalPages ? Math.min(requestedPage, totalPages) : DEFAULT_PAGE;
  const transactions = await Transaction.find(filter)
    .sort({ date: -1, createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit);

  response.set({
    'X-Total-Count': String(total),
    'X-Page': String(page),
    'X-Limit': String(limit),
    'X-Total-Pages': String(totalPages),
  });
  response.json(transactions);
}

export async function createTransaction(request, response) {
  const transaction = await Transaction.create(parseTransactionInput(request.body));
  response.status(201).json(transaction);
}

export async function updateTransaction(request, response) {
  const updates = parseTransactionInput(request.body, { partial: true });
  const transaction = await Transaction.findByIdAndUpdate(request.params.id, updates, {
    new: true,
    runValidators: true,
  });

  if (!transaction) {
    return response.status(404).json({ message: 'Transaction not found.' });
  }
  return response.json(transaction);
}

export async function deleteTransaction(request, response) {
  const transaction = await Transaction.findByIdAndDelete(request.params.id);
  if (!transaction) {
    return response.status(404).json({ message: 'Transaction not found.' });
  }
  return response.status(200).json({ message: 'Transaction deleted.' });
}

export async function getSummary(request, response) {
  const filter = buildTransactionFilter(request.query);
  const [totals, expenseCategories, monthlyTotals] = await Promise.all([
    Transaction.aggregate([
      { $match: filter },
      { $group: { _id: '$type', total: { $sum: '$amount' } } },
    ]),
    Transaction.aggregate([
      { $match: { ...filter, type: 'expense' } },
      { $group: { _id: '$category', total: { $sum: '$amount' } } },
      { $sort: { total: -1 } },
    ]),
    Transaction.aggregate([
      { $match: filter },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m', date: '$date', timezone: 'UTC' } },
          income: { $sum: { $cond: [{ $eq: ['$type', 'income'] }, '$amount', 0] } },
          expenses: { $sum: { $cond: [{ $eq: ['$type', 'expense'] }, '$amount', 0] } },
        },
      },
      { $sort: { _id: 1 } },
    ]),
  ]);

  const totalIncome = roundToCents(totals.find((item) => item._id === 'income')?.total ?? 0);
  const totalExpenses = roundToCents(totals.find((item) => item._id === 'expense')?.total ?? 0);

  response.json({
    totalIncome,
    totalExpenses,
    balance: roundToCents(totalIncome - totalExpenses),
    expensesByCategory: expenseCategories.map(({ _id, total }) => ({ category: _id, total: roundToCents(total) })),
    monthlyData: monthlyTotals.map(({ _id, income, expenses }) => ({
      month: _id,
      income: roundToCents(income),
      expenses: roundToCents(expenses),
    })),
  });
}
