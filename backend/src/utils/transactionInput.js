import ApiError from './ApiError.js';

const allowedFields = new Set(['type', 'amount', 'category', 'description', 'date']);
export const MAX_TRANSACTION_AMOUNT = 1_000_000_000;
export const MAX_CATEGORY_LENGTH = 100;
export const MAX_DESCRIPTION_LENGTH = 500;

function parseAmount(value) {
  if (!['number', 'string'].includes(typeof value)) {
    throw new ApiError(400, 'Amount must be a number with at most two decimal places.');
  }

  const normalized = typeof value === 'string' ? value.trim() : String(value);
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) {
    throw new ApiError(400, 'Amount must be a number with at most two decimal places.');
  }

  const amount = Number(normalized);
  if (!Number.isFinite(amount) || amount < 0.01 || amount > MAX_TRANSACTION_AMOUNT) {
    throw new ApiError(400, `Amount must be between 0.01 and ${MAX_TRANSACTION_AMOUNT.toLocaleString('en-US')}.`);
  }
  return amount;
}

function parseTransactionDate(value) {
  if (typeof value !== 'string') {
    throw new ApiError(400, 'Date must be a valid date string.');
  }

  const parts = value.match(/^(\d{4}-\d{2}-\d{2})(?:T.*)?$/);
  if (!parts) {
    throw new ApiError(400, 'Date must use YYYY-MM-DD or ISO date-time format.');
  }

  const calendarDate = new Date(`${parts[1]}T00:00:00.000Z`);
  const date = new Date(value);
  if (
    Number.isNaN(calendarDate.getTime())
    || calendarDate.toISOString().slice(0, 10) !== parts[1]
    || Number.isNaN(date.getTime())
  ) {
    throw new ApiError(400, 'Date must be a valid calendar date.');
  }

  return date;
}

export function parseTransactionInput(input, { partial = false } = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new ApiError(400, 'Request body must be a JSON object.');
  }

  const suppliedFields = Object.keys(input);
  const unknownFields = suppliedFields.filter((field) => !allowedFields.has(field));
  if (unknownFields.length) {
    throw new ApiError(400, `Unknown field: ${unknownFields[0]}.`);
  }
  if (partial && suppliedFields.length === 0) {
    throw new ApiError(400, 'Provide at least one field to update.');
  }

  const result = {};
  const fieldsToValidate = partial ? suppliedFields : ['type', 'amount', 'category', 'date'];

  for (const field of fieldsToValidate) {
    if (input[field] === undefined && partial) continue;
    if (field === 'description' && partial && input[field] === '') {
      result.description = '';
      continue;
    }
    if (input[field] === undefined || input[field] === null || input[field] === '') {
      throw new ApiError(400, `${field[0].toUpperCase()}${field.slice(1)} is required.`);
    }

    if (field === 'type') {
      if (!['income', 'expense'].includes(input.type)) {
        throw new ApiError(400, 'Type must be either income or expense.');
      }
      result.type = input.type;
    } else if (field === 'amount') {
      result.amount = parseAmount(input.amount);
    } else if (field === 'category') {
      if (typeof input.category !== 'string' || !input.category.trim()) {
        throw new ApiError(400, 'Category must be a non-empty string.');
      }
      const category = input.category.trim();
      if (category.length > MAX_CATEGORY_LENGTH) {
        throw new ApiError(400, `Category cannot exceed ${MAX_CATEGORY_LENGTH} characters.`);
      }
      result.category = category;
    } else if (field === 'description') {
      if (typeof input.description !== 'string') {
        throw new ApiError(400, 'Description must be a string.');
      }
      const description = input.description.trim();
      if (description.length > MAX_DESCRIPTION_LENGTH) {
        throw new ApiError(400, `Description cannot exceed ${MAX_DESCRIPTION_LENGTH} characters.`);
      }
      result.description = description;
    } else if (field === 'date') {
      result.date = parseTransactionDate(input.date);
    }
  }

  if (!partial && input.description !== undefined) {
    if (typeof input.description !== 'string') {
      throw new ApiError(400, 'Description must be a string.');
    }
    const description = input.description.trim();
    if (description.length > MAX_DESCRIPTION_LENGTH) {
      throw new ApiError(400, `Description cannot exceed ${MAX_DESCRIPTION_LENGTH} characters.`);
    }
    result.description = description;
  }

  return result;
}
