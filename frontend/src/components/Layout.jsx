import { Link, NavLink, Outlet } from "react-router-dom";
import { useEffect, useState } from "react";
import ThemeToggle from "./ThemeToggle.jsx";

export default function Layout() {
  const [clock, setClock] = useState(() => stamp());

  useEffect(() => {
    const id = window.setInterval(() => setClock(stamp()), 1000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div className="app">
      <div className="fx-scan" aria-hidden="true" />
      <div className="fx-vignette" aria-hidden="true" />

      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <header className="site-header">
        <div className="header-inner">
          <Link to="/" className="brand" aria-label="YPINR home">
            YP<span>INR</span>
          </Link>
          <nav className="site-nav">
            <span className="sys-clock" aria-hidden="true">
              SYS {clock}
            </span>
            <NavLink to="/sherpa" className="nav-sherpa">Sherpa</NavLink>
            <NavLink to="/scams">Intel</NavLink>
            <ThemeToggle />
            <Link to="/questionnaire" className="nav-cta">
              Run check
            </Link>
          </nav>
        </div>
      </header>

      <main id="main" className="site-main">
        <Outlet />
      </main>

      <footer className="site-footer">
        <div className="footer-inner">
          <p>HopHacks 2026 · threat surface / consumer</p>
          <p className="ticker">0xSCAM · giftcard · vishing · otp · impersonation · ai-voice</p>
        </div>
      </footer>
    </div>
  );
}

function stamp() {
  return new Date().toLocaleTimeString("en-GB", { hour12: false });
}
