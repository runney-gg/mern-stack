import { useEffect, useRef, useState } from 'react';
import { createTransaction, updateTransaction } from '../api/transactions.js';

const categories = {
  income: ['Salary', 'Scholarship', 'Freelance', 'Gift', 'Other'],
  expense: ['Food', 'Transport', 'Housing', 'Bills', 'Education', 'Health', 'Shopping', 'Entertainment', 'Other'],
};

function today() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function TransactionForm({ transaction, onClose, onSaved, returnFocusRef, returnFocusFallbackRef }) {
  const [type, setType] = useState(transaction?.type || 'expense');
  const [form, setForm] = useState({
    amount: transaction?.amount ?? '',
    category: transaction?.category || '',
    date: transaction?.date ? transaction.date.slice(0, 10) : today(),
    description: transaction?.description || '',
  });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const submissionInProgress = useRef(false);
  const dialogRef = useRef(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const isEditing = Boolean(transaction);
  const availableCategories = [...new Set([
    ...categories[type],
    ...(transaction?.type === type && transaction.category ? [transaction.category] : []),
  ])];

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return undefined;

    const previouslyFocused = document.activeElement;
    const focusableSelector = 'button:not([disabled]), a[href], input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
    const getFocusable = () => Array.from(dialog.querySelectorAll(focusableSelector));
    const firstFocusTarget = dialog.querySelector('[data-initial-focus]') || getFocusable()[0] || dialog;
    firstFocusTarget.focus();

    function handleDialogKeyDown(event) {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab') return;

      const focusable = getFocusable();
      if (!focusable.length) {
        event.preventDefault();
        dialog.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const activeElement = document.activeElement;
      if (event.shiftKey && (activeElement === first || activeElement === dialog || !dialog.contains(activeElement))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (activeElement === last || activeElement === dialog || !dialog.contains(activeElement))) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', handleDialogKeyDown);
    return () => {
      document.removeEventListener('keydown', handleDialogKeyDown);
      const opener = returnFocusRef?.current;
      const fallback = returnFocusFallbackRef?.current;
      const restoreTarget = opener?.isConnected
        ? opener
        : fallback?.isConnected
          ? fallback
          : previouslyFocused?.isConnected
            ? previouslyFocused
            : null;
      restoreTarget?.focus();
    };
  }, [returnFocusRef, returnFocusFallbackRef]);

  function updateField(event) {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (submissionInProgress.current) return;
    setError('');
    const amount = Number(form.amount);

    if (!Number.isFinite(amount) || amount <= 0) {
      setError('Enter an amount greater than zero.');
      return;
    }
    if (!form.category) {
      setError('Choose a category.');
      return;
    }
    if (!form.date) {
      setError('Choose a transaction date.');
      return;
    }

    const payload = {
      type,
      amount,
      category: form.category,
      date: new Date(`${form.date}T00:00:00.000Z`).toISOString(),
      description: form.description.trim(),
    };

    submissionInProgress.current = true;
    setSaving(true);
    try {
      if (isEditing) await updateTransaction(transaction._id, payload);
      else await createTransaction(payload);
      submissionInProgress.current = false;
      setSaving(false);
      await onSaved();
    } catch (saveError) {
      submissionInProgress.current = false;
      setError(saveError.message);
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section ref={dialogRef} className="transaction-modal" role="dialog" aria-modal="true" aria-labelledby="transaction-form-title" tabIndex="-1">
        <div className="modal-heading">
          <div>
            <p className="eyebrow">TRANSACTION DETAILS</p>
            <h2 id="transaction-form-title">{isEditing ? 'Edit transaction' : 'Add transaction'}</h2>
          </div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Close form">×</button>
        </div>

        <form onSubmit={handleSubmit} noValidate>
          <fieldset className="type-switch">
            <legend>Transaction type</legend>
            <button className={type === 'expense' ? 'type-option selected expense-selected' : 'type-option'} type="button" aria-pressed={type === 'expense'} onClick={() => { setType('expense'); setForm((current) => ({ ...current, category: '' })); }}>
              <span>↘</span> Expense
            </button>
            <button className={type === 'income' ? 'type-option selected income-selected' : 'type-option'} type="button" aria-pressed={type === 'income'} onClick={() => { setType('income'); setForm((current) => ({ ...current, category: '' })); }}>
              <span>↗</span> Income
            </button>
          </fieldset>

          <label className="field-label" htmlFor="amount">Amount <span>(NPR)</span><span className="required-mark" aria-hidden="true"> *</span></label>
          <div className="amount-input-wrap"><span>NPR</span><input id="amount" name="amount" type="number" min="0.01" max="1000000000" step="0.01" inputMode="decimal" placeholder="0.00" value={form.amount} onChange={updateField} autoFocus data-initial-focus aria-required="true" /></div>

          <div className="form-row">
            <div>
              <label className="field-label" htmlFor="category">Category<span className="required-mark" aria-hidden="true"> *</span></label>
              <select id="category" name="category" value={form.category} onChange={updateField} aria-required="true">
                <option value="">Choose category</option>
                {availableCategories.map((category) => <option key={category} value={category}>{category}</option>)}
              </select>
            </div>
            <div>
              <label className="field-label" htmlFor="date">Date<span className="required-mark" aria-hidden="true"> *</span></label>
              <input id="date" name="date" type="date" value={form.date} onChange={updateField} aria-required="true" />
            </div>
          </div>

          <label className="field-label" htmlFor="description">Description <span>(optional)</span></label>
          <input id="description" name="description" type="text" maxLength="500" placeholder="What was this for?" value={form.description} onChange={updateField} />

          {error && <p className="form-error" role="alert">{error}</p>}
          <div className="form-actions">
            <button className="button secondary-button" type="button" onClick={onClose} disabled={saving}>Cancel</button>
            <button className="button primary-button" type="submit" disabled={saving}>{saving ? 'Saving…' : isEditing ? 'Save changes' : 'Save transaction'}</button>
          </div>
        </form>
      </section>
    </div>
  );
}

export default TransactionForm;
