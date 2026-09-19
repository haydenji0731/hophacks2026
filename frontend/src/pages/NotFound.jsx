import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <section className="page">
      <p className="eyebrow">404</p>
      <h1>Page not found</h1>
      <p className="lede">That route does not exist. Start a check or open the repository.</p>
      <div className="cta-row" style={{ justifyContent: "flex-start" }}>
        <Link className="btn btn-primary" to="/">
          Home
        </Link>
        <Link className="btn btn-secondary" to="/questionnaire">
          Find out
        </Link>
      </div>
    </section>
  );
}
