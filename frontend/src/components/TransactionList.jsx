import { deleteTransaction } from '../api/transactions.js';

const currency = new Intl.NumberFormat('en-NP', { style: 'currency', currency: 'NPR', minimumFractionDigits: 2, maximumFractionDigits: 2 });
const dateFormat = new Intl.DateTimeFormat('en-NP', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

export function formatMoney(value) {
  return currency.format(Number(value) || 0);
}

export function formatDate(value) {
  return dateFormat.format(new Date(value));
}

function TransactionList({ transactions, compact = false, loading = false, loadError = '', pagination, onPageChange, onEdit, onDeleted, onError }) {
  async function handleDelete(transaction) {
    const label = transaction.description || transaction.category;
    if (!window.confirm(`Delete “${label}”? This cannot be undone.`)) return;
    try {
      await deleteTransaction(transaction._id);
      await onDeleted();
    } catch (error) {
      onError(error.message);
    }
  }

  if (loading) {
    return <div className="list-state" role="status" aria-live="polite"><span className="loading-spinner" />Loading transactions…</div>;
  }

  if (loadError) {
    return <div className="list-state" role="alert">Could not load transactions. Use the error notice above to retry.</div>;
  }

  if (!transactions.length) {
    return (
      <div className="list-state empty-state" role="status">
        <span className="empty-state-icon">↔</span>
        <strong>{compact ? 'No recent transactions' : 'No transactions found'}</strong>
        <span>{compact ? 'Add your first transaction to see it here.' : 'Try changing your filters or add a transaction.'}</span>
      </div>
    );
  }

  return (
    <>
      <div className={`table-scroll ${compact ? 'compact-table' : ''}`}>
        <table className="transaction-table">
          <thead><tr><th>Transaction</th><th>Type</th><th>Category</th><th>Date</th><th className="amount-cell">Amount</th><th aria-label="Actions" /></tr></thead>
          <tbody>
            {transactions.map((transaction) => (
              <tr key={transaction._id}>
                <td className="transaction-name-cell" data-label="Transaction"><span className={`transaction-symbol ${transaction.type}`}>{transaction.type === 'income' ? '↗' : '↘'}</span><span><strong>{transaction.description || transaction.category}</strong><small>{transaction.description ? transaction.category : 'No description'}</small></span></td>
                <td data-label="Type"><span className={`type-pill ${transaction.type}`}>{transaction.type}</span></td>
                <td data-label="Category">{transaction.category}</td>
                <td className="date-cell" data-label="Date">{formatDate(transaction.date)}</td>
                <td className={`amount-cell amount-${transaction.type}`} data-label="Amount">{transaction.type === 'income' ? '+' : '−'}{formatMoney(transaction.amount)}</td>
                <td className="row-actions" data-label="Actions">
                  <button type="button" className="table-action" onClick={(event) => onEdit(transaction, event.currentTarget)} aria-label={`Edit ${transaction.description || transaction.category}`}>Edit</button>
                  <button type="button" className="table-action delete-action" onClick={() => handleDelete(transaction)} aria-label={`Delete ${transaction.description || transaction.category}`}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {pagination && pagination.total > 0 && (
        <nav className="pagination" aria-label="Transaction pages">
          <span>{pagination.total} transactions · Page {pagination.page} of {pagination.totalPages}</span>
          <div>
            <button type="button" className="pagination-button" onClick={() => onPageChange(pagination.page - 1)} disabled={pagination.page <= 1}>Previous</button>
            <button type="button" className="pagination-button" onClick={() => onPageChange(pagination.page + 1)} disabled={pagination.page >= pagination.totalPages}>Next</button>
          </div>
        </nav>
      )}
    </>
  );
}

export default TransactionList;
