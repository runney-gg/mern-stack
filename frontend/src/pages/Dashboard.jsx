import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import TransactionForm from '../components/TransactionForm.jsx';
import TransactionList from '../components/TransactionList.jsx';
import { getHealth, getSummary, getTransactionsPage } from '../api/transactions.js';
import Navbar from '../components/Navbar.jsx';
import SummaryCards from '../components/SummaryCards.jsx';

const MonthlyChart = lazy(() => import('../components/FinanceCharts.jsx').then((module) => ({ default: module.MonthlyChart })));
const CategoryChart = lazy(() => import('../components/FinanceCharts.jsx').then((module) => ({ default: module.CategoryChart })));
const TRANSACTION_PAGE_SIZE = 20;

function monthKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function recentMonths(monthlyData) {
  const byMonth = new Map(monthlyData.map((item) => [item.month, item]));
  const now = new Date();
  return Array.from({ length: 6 }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - 5 + index, 1);
    const key = monthKey(date);
    const saved = byMonth.get(key);
    return {
      month: key,
      label: new Intl.DateTimeFormat('en', { month: 'short' }).format(date),
      income: saved?.income || 0,
      expenses: saved?.expenses || 0,
    };
  });
}

function App() {
  const [page, setPage] = useState('overview');
  const [recentTransactions, setRecentTransactions] = useState([]);
  const [visibleTransactions, setVisibleTransactions] = useState([]);
  const [transactionPage, setTransactionPage] = useState(1);
  const [transactionPagination, setTransactionPagination] = useState({ page: 1, limit: TRANSACTION_PAGE_SIZE, total: 0, totalPages: 0 });
  const [monthSummary, setMonthSummary] = useState(null);
  const [allTimeSummary, setAllTimeSummary] = useState(null);
  const [filters, setFilters] = useState({ search: '', month: '', type: '' });
  const [transactionToEdit, setTransactionToEdit] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const transactionOpenerRef = useRef(null);
  const addTransactionButtonRef = useRef(null);
  const [dashboardLoading, setDashboardLoading] = useState(true);
  const [transactionsLoading, setTransactionsLoading] = useState(false);
  const [apiError, setApiError] = useState('');
  const [transactionLoadError, setTransactionLoadError] = useState('');
  const [apiStatus, setApiStatus] = useState('checking');
  const [refreshKey, setRefreshKey] = useState(0);

  const loadDashboard = useCallback(async () => {
    setDashboardLoading(true);
    const results = await Promise.allSettled([
      getHealth(),
      getTransactionsPage({}, { page: 1, limit: 5 }),
      getSummary({ month: monthKey(new Date()) }),
      getSummary(),
    ]);
    const [health, transactions, currentSummary, allSummary] = results;

    if (health.status === 'fulfilled') {
      setApiStatus(health.value.database === 'connected' ? 'connected' : 'database offline');
    } else {
      setApiStatus('unavailable');
    }

    setRecentTransactions(transactions.status === 'fulfilled' ? transactions.value.transactions : []);
    setMonthSummary(currentSummary.status === 'fulfilled' ? currentSummary.value : null);
    setAllTimeSummary(allSummary.status === 'fulfilled' ? allSummary.value : null);
    const failure = results.find((result) => result.status === 'rejected');
    setApiError(failure?.reason?.message || '');
    setDashboardLoading(false);
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard, refreshKey]);

  useEffect(() => {
    if (page !== 'transactions') return undefined;

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setTransactionsLoading(true);
      try {
        const result = await getTransactionsPage(filters, { page: transactionPage, limit: TRANSACTION_PAGE_SIZE });
        if (!cancelled) {
          setVisibleTransactions(result.transactions);
          setTransactionPagination(result.pagination);
          if (result.pagination.page !== transactionPage) setTransactionPage(result.pagination.page);
          setTransactionLoadError('');
          setApiError('');
        }
      } catch (error) {
        if (!cancelled) {
          setVisibleTransactions([]);
          setTransactionPagination({ page: transactionPage, limit: TRANSACTION_PAGE_SIZE, total: 0, totalPages: 0 });
          setTransactionLoadError(error.message);
          setApiError(error.message);
        }
      } finally {
        if (!cancelled) setTransactionsLoading(false);
      }
    }, 180);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [page, filters, refreshKey, transactionPage]);

  const monthlyChartData = useMemo(
    () => recentMonths(allTimeSummary?.monthlyData || []),
    [allTimeSummary],
  );

  function openCreateForm(opener) {
    transactionOpenerRef.current = opener;
    setTransactionToEdit(null);
    setFormOpen(true);
  }

  function openEditForm(transaction, opener) {
    transactionOpenerRef.current = opener;
    setTransactionToEdit(transaction);
    setFormOpen(true);
  }

  async function handleSaved() {
    setFormOpen(false);
    setTransactionToEdit(null);
    setTransactionPage(1);
    setRefreshKey((current) => current + 1);
  }

  function clearFilters() {
    setTransactionPage(1);
    setFilters({ search: '', month: '', type: '' });
  }

  function updateFilters(change) {
    setTransactionPage(1);
    setFilters((current) => ({ ...current, ...change }));
  }

  const heading = page === 'overview'
    ? { eyebrow: 'YOUR MONEY, MADE CLEAR', title: 'Overview', subtitle: 'A clear view of what is coming in and going out.' }
    : { eyebrow: 'YOUR ACTIVITY', title: 'Transactions', subtitle: 'Search, review, and manage your income and expenses.' };

  return (
    <div className="app-shell">
      <Navbar page={page} setPage={setPage} />

      <main className="main-content">
        <header className="topbar">
          <p className="breadcrumb">Workspace <span>/</span> <strong>{page === 'overview' ? 'Overview' : 'Transactions'}</strong></p>
          <div className="topbar-right">
            <span className={`connection-status ${apiStatus.replace(' ', '-')}`} role="status" aria-live="polite"><i />{apiStatus === 'checking' ? 'Checking API' : apiStatus === 'connected' ? 'Connected' : apiStatus === 'database offline' ? 'Database offline' : 'API unavailable'}</span>
            <span className="today-label">{new Intl.DateTimeFormat('en', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }).format(new Date()).toUpperCase()}</span>
          </div>
        </header>

        <section className="page-heading">
          <div><p className="eyebrow">{heading.eyebrow}</p><h1>{heading.title}</h1><p className="subheading">{heading.subtitle}</p></div>
          <button ref={addTransactionButtonRef} className="button primary-button add-button" type="button" onClick={(event) => openCreateForm(event.currentTarget)}><span>＋</span> Add transaction</button>
        </section>

        {apiError && <div className="api-notice" role="alert"><span className="notice-icon">!</span><span>{apiError}</span><button type="button" onClick={() => setRefreshKey((current) => current + 1)}>Retry</button></div>}

        {page === 'overview' ? (
          <>
            <SummaryCards summary={monthSummary} loading={dashboardLoading} />

            <section className="content-grid" aria-label="Spending reports">
              <article className="panel spending-panel" id="reports">
                <div className="panel-heading"><div><h2>Income vs. expenses</h2><p>Monthly cash flow over the last six months</p></div><span className="panel-period">Last 6 months</span></div>
                {dashboardLoading ? <ChartLoading /> : <Suspense fallback={<ChartLoading />}><MonthlyChart data={monthlyChartData} /></Suspense>}
                <div className="chart-legend"><span><i className="legend-dot income-dot" />Income</span><span><i className="legend-dot expense-dot" />Expenses</span></div>
              </article>

              <article className="panel categories-panel">
                <div className="panel-heading"><div><h2>Spending by category</h2><p>Expense breakdown this month</p></div><span className="panel-period">This month</span></div>
                {dashboardLoading ? <ChartLoading /> : <Suspense fallback={<ChartLoading />}><CategoryChart data={monthSummary?.expensesByCategory || []} /></Suspense>}
              </article>
            </section>

            <section className="panel transactions-panel">
              <div className="panel-heading transaction-heading"><div><h2>Recent transactions</h2><p>Your latest income and expenses</p></div><button className="text-button" type="button" onClick={() => setPage('transactions')}>View all <span>→</span></button></div>
              <TransactionList transactions={recentTransactions} compact loading={dashboardLoading} onEdit={openEditForm} onDeleted={() => setRefreshKey((current) => current + 1)} onError={setApiError} />
            </section>
          </>
        ) : (
          <section className="panel transactions-page-panel">
            <div className="filter-bar">
              <label className="search-field"><span>⌕</span><input type="search" placeholder="Search transactions" aria-label="Search transactions" value={filters.search} onChange={(event) => updateFilters({ search: event.target.value })} /></label>
              <label className="filter-control"><span>Month</span><input type="month" aria-label="Filter by month" value={filters.month} onChange={(event) => updateFilters({ month: event.target.value })} /></label>
              <label className="filter-control"><span>Type</span><select aria-label="Filter by transaction type" value={filters.type} onChange={(event) => updateFilters({ type: event.target.value })}><option value="">All types</option><option value="income">Income</option><option value="expense">Expense</option></select></label>
              {(filters.search || filters.month || filters.type) && <button className="clear-filters" type="button" onClick={clearFilters}>Clear filters</button>}
            </div>
            <TransactionList transactions={visibleTransactions} loading={transactionsLoading} loadError={transactionLoadError} pagination={transactionPagination} onPageChange={setTransactionPage} onEdit={openEditForm} onDeleted={() => setRefreshKey((current) => current + 1)} onError={setApiError} />
          </section>
        )}

        <footer className="footer-note"><span>Made for mindful money days</span><span>SpendWise <i>·</i> NPR</span></footer>
      </main>

      {formOpen && <TransactionForm key={transactionToEdit?._id || 'new-transaction'} transaction={transactionToEdit} onClose={() => setFormOpen(false)} onSaved={handleSaved} returnFocusRef={transactionOpenerRef} returnFocusFallbackRef={addTransactionButtonRef} />}
    </div>
  );
}

function ChartLoading() {
  return <div className="chart-loading" role="status" aria-live="polite"><span className="loading-spinner" />Loading report…</div>;
}

export default App;
