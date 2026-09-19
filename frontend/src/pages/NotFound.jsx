import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <section className="page">
      <h1>Page not found</h1>
      <Link className="btn btn-secondary" to="/">
        Go home
      </Link>
    </section>
  );
}
