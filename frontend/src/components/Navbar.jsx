export default function Navbar({ page, setPage }) {
  return (
    <aside className="sidebar">
      <a className="brand" href="#overview" onClick={() => setPage('overview')} aria-label="SpendWise overview">
        <span className="brand-mark">s</span><span>spend<span className="brand-light">wise</span></span>
      </a>
      <p className="nav-caption">YOUR SPACE</p>
      <nav className="main-nav" aria-label="Main navigation">
        <button className={`nav-link ${page === 'overview' ? 'active' : ''}`} type="button" aria-current={page === 'overview' ? 'page' : undefined} onClick={() => setPage('overview')}><span className="nav-icon">▦</span>Overview</button>
        <button className={`nav-link ${page === 'transactions' ? 'active' : ''}`} type="button" aria-current={page === 'transactions' ? 'page' : undefined} onClick={() => setPage('transactions')}><span className="nav-icon">↔</span>Transactions</button>
      </nav>
      <div className="sidebar-bottom"><span className="profile-avatar">S</span><span><strong>My finances</strong><small>Personal account</small></span><span className="sidebar-currency">NPR</span></div>
    </aside>
  );
}
