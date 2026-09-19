const LIVE = new Set([
  "Discord",
  "Chrome",
  "iOS",
  "Instagram",
  "Web",
  "Windows",
  "Facebook",
  "Android",
  "Reddit",
  "Phone",
]);

const ROWS = [
  ["Discord", "Windows", "macOS", "Chrome", "iOS"],
  ["Android", "Instagram", "WhatsApp", "Telegram", "SMS"],
  ["Facebook", "Phone", "TikTok", "Web", "Reddit"],
];

function Loop({ names }) {
  return (
    <span className="compat-loop">
      {names.map((name, i) => (
        <span key={`${name}-${i}`} className="compat-item">
          {i > 0 ? <span className="compat-sep">·</span> : null}
          <span className={LIVE.has(name) ? "compat-name is-solid" : "compat-name"}>
            {name}
          </span>
        </span>
      ))}
      <span className="compat-sep">·</span>
    </span>
  );
}

export default function CompatMarquee() {
  return (
    <div className="compat-marquee reveal delay-6">
      <span className="compat-label">Compatible with</span>
      <div className="compat-reels" aria-label="Compatible platforms">
        {ROWS.map((names, row) => {
          const strip = [...names, ...names];
          const dir = row % 2 === 0 ? "left" : "right";
          return (
            <div
              key={dir + row}
              className={`compat-track is-${dir}`}
              style={{ "--compat-dur": `${36 + row * 8}s` }}
            >
              <Loop names={strip} />
              <Loop names={strip} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
