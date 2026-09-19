import { Link, NavLink, Outlet } from "react-router-dom";

export default function Layout() {
  return (
    <div className="app">
      <header className="site-header">
        <Link to="/" className="brand">
          We<span>Hate</span>Scammers
        </Link>
        <nav className="site-nav">
          <NavLink to="/questionnaire">Am I being scammed?</NavLink>
          <NavLink to="/scams">Scam repository</NavLink>
        </nav>
      </header>

      <main className="site-main">
        <Outlet />
      </main>

      <footer className="site-footer">
        <p>HopHacks 2026 · wehatescammers.com (pending)</p>
      </footer>
    </div>
  );
}
