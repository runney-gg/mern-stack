// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useRef, useState } from 'react';
import TransactionForm from './TransactionForm.jsx';
import { createTransaction } from '../api/transactions.js';

vi.mock('../api/transactions.js', () => ({
  createTransaction: vi.fn(),
  updateTransaction: vi.fn(),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function FormHarness({ onSaved = vi.fn() }) {
  const [open, setOpen] = useState(false);
  const openerRef = useRef(null);
  const fallbackRef = useRef(null);

  return (
    <>
      <button ref={openerRef} type="button" onClick={() => setOpen(true)}>Open transaction form</button>
      <button ref={fallbackRef} type="button">Add transaction</button>
      {open && (
        <TransactionForm
          onClose={() => setOpen(false)}
          onSaved={onSaved}
          returnFocusRef={openerRef}
          returnFocusFallbackRef={fallbackRef}
        />
      )}
    </>
  );
}

describe('TransactionForm interactions', () => {
  it('focuses the form, traps keyboard focus, closes with Escape, and restores focus', async () => {
    render(<FormHarness />);
    const opener = screen.getByRole('button', { name: 'Open transaction form' });
    fireEvent.click(opener);

    const amount = screen.getByLabelText(/Amount/);
    const save = screen.getByRole('button', { name: 'Save transaction' });
    const close = screen.getByRole('button', { name: 'Close form' });
    await waitFor(() => expect(document.activeElement).toBe(amount));
    expect(amount.getAttribute('aria-required')).toBe('true');
    expect(amount.getAttribute('max')).toBe('1000000000');
    expect(screen.getByRole('button', { name: /Expense/ }).getAttribute('aria-pressed')).toBe('true');

    save.focus();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(document.activeElement).toBe(close);

    close.focus();
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(save);

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(opener);
  });

  it('validates required fields and submits a valid transaction', async () => {
    createTransaction.mockResolvedValue({ _id: 'new-transaction' });
    const onSaved = vi.fn();
    render(<FormHarness onSaved={onSaved} />);
    fireEvent.click(screen.getByRole('button', { name: 'Open transaction form' }));

    fireEvent.click(screen.getByRole('button', { name: 'Save transaction' }));
    expect((await screen.findByRole('alert')).textContent).toContain('Enter an amount greater than zero.');
    expect(createTransaction).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText(/Amount/), { target: { value: '12.5' } });
    fireEvent.change(screen.getByLabelText(/^Category/), { target: { value: 'Food' } });
    fireEvent.change(screen.getByLabelText(/Description/), { target: { value: 'Lunch' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save transaction' }));

    await waitFor(() => expect(createTransaction).toHaveBeenCalledTimes(1));
    expect(createTransaction).toHaveBeenCalledWith(expect.objectContaining({
      type: 'expense',
      amount: 12.5,
      category: 'Food',
      description: 'Lunch',
    }));
    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
  });
});
