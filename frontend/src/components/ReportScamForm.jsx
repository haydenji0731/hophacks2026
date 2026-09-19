import { useState } from "react";

const PLATFORMS = [
  { value: "phone", label: "Phone" },
  { value: "sms", label: "SMS" },
  { value: "web", label: "Web" },
  { value: "email", label: "Email" },
  { value: "discord", label: "Discord" },
  { value: "facebook", label: "Facebook" },
  { value: "instagram", label: "Instagram" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "other", label: "Other" },
];

const DEMANDS = [
  { value: "cash", label: "Cash" },
  { value: "gift_card", label: "Gift card" },
  { value: "wire", label: "Wire" },
  { value: "crypto", label: "Crypto" },
  { value: "check", label: "Check" },
  { value: "other", label: "Other" },
];

const ROLES = [
  "elderly individual",
  "job seeker",
  "seller",
  "small business owner",
  "employee",
  "general consumer",
];

const PLATFORM_ENUM = {
  phone: "phone",
  sms: "sms",
  web: "web",
  email: "web",
  discord: "discord",
};

function slugify(name) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80);
}

function toggle(list, value) {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
}

export default function ReportScamForm() {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [platforms, setPlatforms] = useState([]);
  const [demands, setDemands] = useState([]);
  const [roles, setRoles] = useState([]);
  const [status, setStatus] = useState("idle");
  const [message, setMessage] = useState("");

  async function onSubmit(event) {
    event.preventDefault();
    const name = slugify(title);
    if (!name || !description.trim()) {
      setStatus("error");
      setMessage("Pattern name and description are required.");
      return;
    }
    setStatus("saving");
    setMessage("");
    try {
      const response = await fetch("/api/v1/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scam_type: name,
          reasoning: description.trim(),
          platform: PLATFORM_ENUM[platforms[0]] || "other",
          method: demands.length ? demands.join(", ") : "none",
          target: roles.length ? roles.join(", ") : "unclear",
        }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(body.detail?.detail || body.detail || "Could not save this pattern.");
      }
      const skipped = body.db?.action === "skipped";
      setStatus(skipped ? "error" : "done");
      setMessage(
        skipped
          ? body.warnings?.[0] || "Saved locally, but the catalog database was unavailable."
          : `Logged as ${body.db?.name || name}. ${body.db?.frequency || 1} report${body.db?.frequency === 1 ? "" : "s"} in the catalog.`,
      );
    } catch (err) {
      setStatus("error");
      setMessage(err.message || "Could not save this pattern.");
    }
  }

  return (
    <div className="report-scam">
      <button
        className="btn btn-primary"
        type="button"
        aria-expanded={open}
        aria-controls="report-scam-form"
        onClick={() => setOpen((value) => !value)}
      >
        {open ? "Close form" : "Report a scam"}
      </button>

      {open ? (
        <form id="report-scam-form" className="report-scam-form" onSubmit={onSubmit}>
          <p className="eyebrow">Pattern report</p>
          <p className="muted">
            Same fields as the intel catalog: a snake-case pattern, how it unfolds, platforms,
            what they asked for, and who it targeted. No personal data.
          </p>

          <label className="field">
            <span>Pattern name</span>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Facebook marketplace overpay"
              required
            />
          </label>

          <label className="field">
            <span>Description</span>
            <textarea
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="How it unfolds, pressure language, and what they asked for — never names or account numbers."
              required
            />
          </label>

          <fieldset className="field">
            <span>Platforms</span>
            <div className="chip-row">
              {PLATFORMS.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  className={platforms.includes(item.value) ? "chip is-on" : "chip"}
                  onClick={() => setPlatforms(toggle(platforms, item.value))}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset className="field">
            <span>Asks for</span>
            <div className="chip-row">
              {DEMANDS.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  className={demands.includes(item.value) ? "chip is-on" : "chip"}
                  onClick={() => setDemands(toggle(demands, item.value))}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset className="field">
            <span>Victim role</span>
            <div className="chip-row">
              {ROLES.map((item) => (
                <button
                  key={item}
                  type="button"
                  className={roles.includes(item) ? "chip is-on" : "chip"}
                  onClick={() => setRoles(toggle(roles, item))}
                >
                  {item}
                </button>
              ))}
            </div>
          </fieldset>

          {message ? (
            <p className={status === "error" ? "report-status error" : "report-status"}>{message}</p>
          ) : null}

          <div className="cta-row" style={{ justifyContent: "flex-start", marginTop: "0.5rem" }}>
            <button className="btn btn-primary" type="submit" disabled={status === "saving" || status === "done"}>
              {status === "saving" ? "Saving…" : status === "done" ? "Reported" : "Submit pattern"}
            </button>
          </div>
        </form>
      ) : null}
    </div>
  );
}
