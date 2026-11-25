import { formatMoney } from './TransactionList.jsx';

const cards = [
  { label: 'Total income', key: 'totalIncome', type: 'income', icon: '↗' },
  { label: 'Total expenses', key: 'totalExpenses', type: 'expense', icon: '↘' },
  { label: 'Available balance', key: 'balance', type: 'balance', icon: '◈' },
];

export default function SummaryCards({ summary, loading }) {
  return (
    <section className="metrics-grid" aria-label="This month summary">
      {cards.map(({ label, key, type, icon }) => (
        <article className="metric-card" key={key}>
          <div className="metric-top"><span>{label}</span><span className={`metric-icon ${type}`}>{icon}</span></div>
          {loading ? <div className="skeleton-value" /> : <p className={`metric-amount ${type === 'expense' ? 'amount-expense' : ''}`}>{formatMoney(summary?.[key] ?? 0)}</p>}
          <p className="metric-note"><span className={`status-dot ${type}`} />{type === 'balance' ? 'Income minus expenses' : 'This month'}</p>
        </article>
      ))}
    </section>
  );
}
