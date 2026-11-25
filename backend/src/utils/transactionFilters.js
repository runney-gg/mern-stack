import ApiError from './ApiError.js';
import { MAX_CATEGORY_LENGTH } from './transactionInput.js';

const MAX_SEARCH_LENGTH = 100;

function parseDate(value, field) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new ApiError(400, `${field} must use YYYY-MM-DD format.`);
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new ApiError(400, `${field} must be a valid calendar date.`);
  }
  return date;
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function getQueryString(query, field) {
  const value = query[field];
  if (value === undefined) return undefined;
  if (typeof value !== 'string') {
    throw new ApiError(400, `${field} must be a string.`);
  }
  return value;
}

export function buildTransactionFilter(query) {
  const filter = {};
  const dateConditions = [];
  const type = getQueryString(query, 'type');
  const month = getQueryString(query, 'month');
  const startDate = getQueryString(query, 'startDate');
  const endDate = getQueryString(query, 'endDate');
  const category = getQueryString(query, 'category');
  const search = getQueryString(query, 'search');

  if (type !== undefined) {
    if (!['income', 'expense'].includes(type)) {
      throw new ApiError(400, 'Type must be either income or expense.');
    }
    filter.type = type;
  }

  if (month !== undefined) {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
      throw new ApiError(400, 'Month must use YYYY-MM format.');
    }
    const [year, monthNumber] = month.split('-').map(Number);
    dateConditions.push({
      $gte: new Date(Date.UTC(year, monthNumber - 1, 1)),
      $lt: new Date(Date.UTC(year, monthNumber, 1)),
    });
  }

  if (startDate !== undefined) {
    dateConditions.push({ $gte: parseDate(startDate, 'startDate') });
  }
  if (endDate !== undefined) {
    const end = parseDate(endDate, 'endDate');
    end.setUTCDate(end.getUTCDate() + 1);
    dateConditions.push({ $lt: end });
  }

  if (dateConditions.length) {
    const lowerBounds = dateConditions.filter((condition) => condition.$gte).map((condition) => condition.$gte);
    const upperBounds = dateConditions.filter((condition) => condition.$lt).map((condition) => condition.$lt);
    filter.date = {
      ...(lowerBounds.length ? { $gte: new Date(Math.max(...lowerBounds)) } : {}),
      ...(upperBounds.length ? { $lt: new Date(Math.min(...upperBounds)) } : {}),
    };
    if (filter.date.$gte && filter.date.$lt && filter.date.$gte >= filter.date.$lt) {
      throw new ApiError(400, 'The selected date range is empty.');
    }
  }

  if (category !== undefined) {
    if (category.length > MAX_CATEGORY_LENGTH) {
      throw new ApiError(400, `Category filter cannot exceed ${MAX_CATEGORY_LENGTH} characters.`);
    }
    const normalizedCategory = category.trim();
    if (!normalizedCategory) {
      throw new ApiError(400, 'Category filter cannot be empty.');
    }
    if (normalizedCategory.length > MAX_CATEGORY_LENGTH) {
      throw new ApiError(400, `Category filter cannot exceed ${MAX_CATEGORY_LENGTH} characters.`);
    }
    filter.category = new RegExp(`^${escapeRegex(normalizedCategory)}$`, 'i');
  }

  if (search !== undefined && search.length > MAX_SEARCH_LENGTH) {
    throw new ApiError(400, `Search cannot exceed ${MAX_SEARCH_LENGTH} characters.`);
  }
  if (search?.trim()) {
    const normalizedSearch = search.trim();
    if (normalizedSearch.length > MAX_SEARCH_LENGTH) {
      throw new ApiError(400, `Search cannot exceed ${MAX_SEARCH_LENGTH} characters.`);
    }
    const expression = new RegExp(escapeRegex(normalizedSearch), 'i');
    filter.$or = [{ category: expression }, { description: expression }];
  }

  return filter;
}
