// Small illustrations for the "what you can check" carousel. Decorative only (aria-hidden by the caller), drawn with
// the brand tokens so they follow light and dark mode. The scenes are made up: no real names, numbers or logos.

const line = "var(--border)";
const ink = "var(--foreground)";
const brand = "var(--primary)";

export function TextVisual() {
  return (
    <svg viewBox="0 0 280 150" role="presentation">
      <rect x="22" y="22" width="170" height="52" rx="14" fill="var(--card)" stroke={line} />
      <rect x="38" y="38" width="118" height="7" rx="3.5" fill={ink} opacity=".72" />
      <rect x="38" y="54" width="76" height="7" rx="3.5" fill={line} />
      <rect x="92" y="88" width="166" height="40" rx="14" fill={brand} />
      <rect x="108" y="102" width="96" height="7" rx="3.5" fill="#fff" opacity=".9" />
      <circle cx="238" cy="30" r="6" fill={brand} opacity=".25" />
    </svg>
  );
}

export function ImageVisual() {
  return (
    <svg viewBox="0 0 280 150" role="presentation">
      <rect x="84" y="12" width="112" height="126" rx="14" fill="var(--card)" stroke={line} />
      <rect x="100" y="28" width="80" height="34" rx="8" fill="var(--accent)" />
      <path d="M108 54l16-16 12 12 10-8 22 12z" fill={brand} opacity=".55" />
      <circle cx="162" cy="40" r="5" fill={brand} opacity=".7" />
      <rect x="100" y="74" width="80" height="7" rx="3.5" fill={ink} opacity=".7" />
      <rect x="100" y="90" width="58" height="7" rx="3.5" fill={line} />
      <rect x="100" y="106" width="68" height="7" rx="3.5" fill={line} />
    </svg>
  );
}

export function QrVisual() {
  // A decorative QR-like pattern (not a real code).
  const cells = "0110101 1001110 0101101 1110010 0011011 1010101 0101110".split(" ");
  return (
    <svg viewBox="0 0 280 150" role="presentation">
      <rect x="100" y="14" width="80" height="80" rx="12" fill="var(--card)" stroke={line} />
      {cells.flatMap((row, y) => [...row].map((c, x) => (c === "1" ? <rect key={`${x}-${y}`} x={110 + x * 8.6} y={24 + y * 8.6} width="6.4" height="6.4" rx="1.6" fill={ink} opacity=".78" /> : null)))}
      <path d="M108 30h16v16h-16zM156 30h16v16h-16zM108 70h16v16h-16z" fill="none" stroke={brand} strokeWidth="3" />
      <rect x="86" y="108" width="108" height="26" rx="13" fill="var(--accent)" />
      <rect x="104" y="117" width="72" height="7" rx="3.5" fill={brand} opacity=".85" />
    </svg>
  );
}

export function LinkVisual() {
  return (
    <svg viewBox="0 0 280 150" role="presentation">
      <rect x="28" y="22" width="224" height="38" rx="19" fill="var(--card)" stroke={line} />
      <circle cx="52" cy="41" r="7" fill="none" stroke={brand} strokeWidth="2.4" />
      <rect x="70" y="37" width="120" height="8" rx="4" fill={ink} opacity=".7" />
      <rect x="28" y="84" width="64" height="34" rx="12" fill="var(--card)" stroke={line} />
      <rect x="108" y="84" width="64" height="34" rx="12" fill="var(--card)" stroke={line} />
      <rect x="188" y="84" width="64" height="34" rx="12" fill="var(--accent)" stroke={brand} />
      <path d="M96 101h8m72 0h8" stroke={brand} strokeWidth="2.6" strokeLinecap="round" />
      <path d="M100 97l5 4-5 4m80-8l5 4-5 4" fill="none" stroke={brand} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function VoiceVisual() {
  const heights = [18, 34, 54, 30, 70, 44, 82, 50, 26, 62, 38, 76, 42, 22, 58, 34, 16];
  return (
    <svg viewBox="0 0 280 150" role="presentation" className="voice-visual">
      <rect x="20" y="30" width="240" height="90" rx="20" fill="var(--card)" stroke={line} />
      {heights.map((h, i) => (
        <rect key={i} className="voice-bar" style={{ animationDelay: `${i * 70}ms` }} x={42 + i * 13} y={75 - h / 2} width="6" height={h} rx="3" fill={i % 5 === 2 ? brand : ink} opacity={i % 5 === 2 ? 1 : 0.55} />
      ))}
    </svg>
  );
}
