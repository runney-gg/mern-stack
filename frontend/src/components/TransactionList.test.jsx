// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import TransactionList from './TransactionList.jsx';
import { deleteTransaction } from '../api/transactions.js';

vi.mock('../api/transactions.js', () => ({
  deleteTransaction: vi.fn(),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

const transaction = {
  _id: 'transaction-1',
  type: 'expense',
  amount: 12.5,
  category: 'Food',
  description: 'Lunch',
  date: '2026-11-09T00:00:00.000Z',
};

describe('TransactionList interactions', () => {
  it('passes the selected transaction and edit button to the edit handler', () => {
    const onEdit = vi.fn();
    render(<TransactionList transactions={[transaction]} onEdit={onEdit} />);

    const editButton = screen.getByRole('button', { name: 'Edit Lunch' });
    fireEvent.click(editButton);

    expect(onEdit).toHaveBeenCalledWith(transaction, editButton);
  });

  it('deletes only after confirmation and refreshes the list after success', async () => {
    deleteTransaction.mockResolvedValue({ message: 'Transaction deleted.' });
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const onDeleted = vi.fn();
    render(<TransactionList transactions={[transaction]} onDeleted={onDeleted} />);

    fireEvent.click(screen.getByRole('button', { name: 'Delete Lunch' }));
    await waitFor(() => expect(deleteTransaction).toHaveBeenCalledWith(transaction._id));
    expect(onDeleted).toHaveBeenCalledTimes(1);

    confirm.mockReturnValue(false);
    fireEvent.click(screen.getByRole('button', { name: 'Delete Lunch' }));
    expect(deleteTransaction).toHaveBeenCalledTimes(1);
  });

  it('keeps loading, error, and empty-list states understandable', () => {
    const { rerender } = render(<TransactionList transactions={[]} loading />);
    expect(screen.getByRole('status').textContent).toContain('Loading transactions');

    rerender(<TransactionList transactions={[]} loadError="API unavailable" />);
    expect(screen.getByRole('alert').textContent).toContain('Could not load transactions');

    rerender(<TransactionList transactions={[]} />);
    expect(screen.getByRole('status').textContent).toContain('No transactions found');
  });
});
