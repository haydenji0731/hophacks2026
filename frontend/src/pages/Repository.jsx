export default function Repository() {
  // TODO: fetch + search scam records from the API.
  return (
    <section className="page">
      <h1>Scam repository</h1>
      <p className="lede">Browse and search known scam patterns.</p>

      <input className="search" type="search" placeholder="Search scams…" />

      <ul className="scam-list">
        {/* TODO: map over scam records → link to /scams/:id */}
        <li className="placeholder-card">Scam records go here.</li>
      </ul>
    </section>
  );
}
