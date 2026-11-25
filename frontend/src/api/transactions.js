const API_ROOT = import.meta.env.VITE_API_URL || '/api';

async function request(path, options = {}, includeHeaders = false) {
  let response;
  try {
    response = await fetch(`${API_ROOT}${path}`, {
      headers: { 'Content-Type': 'application/json', ...options.headers },
      ...options,
    });
  } catch {
    throw new Error('Cannot reach the SpendWise API. Check that the backend is running.');
  }

  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error('The API returned an unreadable response. Check the backend URL and Vite proxy.');
  }
  if (!response.ok) {
    throw new Error(data.message || `Request failed (${response.status}).`);
  }
  return includeHeaders ? { data, headers: response.headers } : data;
}

export function getHealth() {
  return request('/health');
}

export async function getTransactionsPage(filters = {}, pagination = {}) {
  const query = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value) query.set(key, value);
  });
  const page = pagination.page ?? 1;
  const limit = pagination.limit ?? 20;
  query.set('page', String(page));
  query.set('limit', String(limit));

  const { data, headers } = await request(`/transactions?${query.toString()}`, {}, true);
  if (!Array.isArray(data)) {
    throw new Error('The API returned an unexpected transaction list.');
  }

  return {
    transactions: data,
    pagination: {
      page: Number(headers.get('x-page')) || page,
      limit: Number(headers.get('x-limit')) || limit,
      total: Number(headers.get('x-total-count')) || 0,
      totalPages: Number(headers.get('x-total-pages')) || 0,
    },
  };
}

export function getTransactions(filters = {}) {
  return getTransactionsPage(filters).then(({ transactions }) => transactions);
}

export function getSummary(filters = {}) {
  const query = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value) query.set(key, value);
  });
  const suffix = query.size ? `?${query.toString()}` : '';
  return request(`/summary${suffix}`);
}

export function createTransaction(transaction) {
  return request('/transactions', {
    method: 'POST',
    body: JSON.stringify(transaction),
  });
}

export function updateTransaction(id, transaction) {
  return request(`/transactions/${id}`, {
    method: 'PUT',
    body: JSON.stringify(transaction),
  });
}

export function deleteTransaction(id) {
  return request(`/transactions/${id}`, { method: 'DELETE' });
}
