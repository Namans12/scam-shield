// Illustrations for the "what you can check" carousel. Decorative only (aria-hidden by the caller), drawn with the brand
// tokens so they follow light and dark mode. The scenes are made up: no real names, numbers, codes or logos.

const line = "var(--border)";
const ink = "var(--foreground)";
const brand = "var(--primary)";
const soft = "var(--accent)";

export function TextVisual() {
  return (
    <svg viewBox="0 0 280 150" role="presentation">
      <rect x="26" y="20" width="176" height="56" rx="16" fill="var(--card)" stroke={line} />
      <rect x="44" y="37" width="124" height="7" rx="3.5" fill={ink} opacity=".72" />
      <rect x="44" y="53" width="82" height="7" rx="3.5" fill={line} />
      <path d="M44 76l-8 10 18-6z" fill="var(--card)" stroke={line} />
      <rect x="86" y="92" width="168" height="40" rx="16" fill={brand} />
      <rect x="104" y="108" width="100" height="7" rx="3.5" fill="#fff" opacity=".92" />
      <circle cx="238" cy="30" r="9" fill={soft} />
      <circle cx="238" cy="30" r="3.4" fill={brand} />
    </svg>
  );
}

export function ImageVisual() {
  return (
    <svg viewBox="0 0 280 150" role="presentation">
      <rect x="78" y="10" width="124" height="132" rx="16" fill="var(--card)" stroke={line} />
      <rect x="96" y="26" width="88" height="40" rx="9" fill={soft} />
      <path d="M104 58l18-18 13 13 11-9 24 14z" fill={brand} opacity=".5" />
      <circle cx="166" cy="38" r="5.5" fill={brand} opacity=".75" />
      <rect x="96" y="80" width="88" height="7" rx="3.5" fill={ink} opacity=".7" />
      <rect x="96" y="96" width="62" height="7" rx="3.5" fill={line} />
      <rect x="96" y="112" width="74" height="7" rx="3.5" fill={line} />
      <rect x="150" y="76" width="42" height="15" rx="7.5" fill="none" stroke={brand} strokeWidth="2.2" strokeDasharray="4 3" />
    </svg>
  );
}

/** A small, valid-looking QR layout: three finder patterns and a fixed pseudo-random data field (not a real code). */
const QR_SIZE = 15;
function qrModules(): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  let seed = 7;
  for (let y = 0; y < QR_SIZE; y++) {
    for (let x = 0; x < QR_SIZE; x++) {
      const inFinder = (x < 8 && y < 8) || (x > 6 && y < 8) || (x < 8 && y > 6);
      seed = (seed * 73 + 41) % 251;
      if (!inFinder && seed % 5 < 2) out.push([x, y]);
    }
  }
  return out;
}
const QR_DATA = qrModules();

function Finder({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <rect width="42" height="42" rx="9" fill={ink} />
      <rect x="6" y="6" width="30" height="30" rx="5" fill="var(--card)" />
      <rect x="12" y="12" width="18" height="18" rx="3.5" fill={brand} />
    </g>
  );
}

export function QrVisual() {
  const ox = 70;
  const oy = 14;
  const pad = 12;
  const m = 6;
  return (
    <svg viewBox="0 0 280 150" role="presentation" className="qr-visual">
      <rect x={ox - pad} y={oy - pad + 4} width={QR_SIZE * m + pad * 2} height={QR_SIZE * m + pad * 2} rx="14" fill="var(--card)" stroke={line} />
      <Finder x={ox} y={oy + 4} />
      <Finder x={ox + (QR_SIZE - 7) * m} y={oy + 4} />
      <Finder x={ox} y={oy + 4 + (QR_SIZE - 7) * m} />
      {QR_DATA.map(([x, y]) => (
        <rect key={`${x}-${y}`} x={ox + x * m + 0.5} y={oy + 4 + y * m + 0.5} width={m - 1} height={m - 1} rx="1.4" fill={ink} opacity=".82" />
      ))}
      {/* scan frame */}
      <g fill="none" stroke={brand} strokeWidth="3.2" strokeLinecap="round">
        <path d="M52 30v-12h12M168 18h12v12M180 108v12h-12M64 120H52v-12" />
      </g>
      <rect className="qr-scan-line" x={ox - 4} y={oy + 14} width={QR_SIZE * m + 8} height="3" rx="1.5" fill={brand} opacity=".85" />
      {/* what the code asks */}
      <g transform="translate(196 52)">
        <rect width="72" height="50" rx="12" fill="var(--card)" stroke={brand} />
        <rect x="12" y="12" width="30" height="6" rx="3" fill={ink} opacity=".7" />
        <rect x="12" y="25" width="46" height="9" rx="4.5" fill={brand} />
        <rect x="12" y="38" width="22" height="4" rx="2" fill={line} />
      </g>
      <path d="M180 76h14" stroke={brand} strokeWidth="2.4" strokeLinecap="round" strokeDasharray="1 5" />
    </svg>
  );
}

export function LinkVisual() {
  return (
    <svg viewBox="0 0 280 150" role="presentation">
      <rect x="28" y="12" width="224" height="126" rx="16" fill="var(--card)" stroke={line} />
      <path d="M28 40h224" stroke={line} />
      <circle cx="46" cy="26" r="3.6" fill={line} />
      <circle cx="59" cy="26" r="3.6" fill={line} />
      <circle cx="72" cy="26" r="3.6" fill={line} />
      <rect x="88" y="18" width="150" height="17" rx="8.5" fill={soft} />
      <circle cx="100" cy="26.5" r="4.4" fill="none" stroke={brand} strokeWidth="1.8" />
      <path d="M103.2 29.8l3.4 3.4" stroke={brand} strokeWidth="1.8" strokeLinecap="round" />
      <rect x="114" y="23.5" width="92" height="6" rx="3" fill={ink} opacity=".6" />
      {/* the path a link takes */}
      <g>
        <rect x="42" y="60" width="52" height="38" rx="11" fill="var(--card)" stroke={line} />
        <rect x="50" y="72" width="30" height="5" rx="2.5" fill={ink} opacity=".6" />
        <rect x="50" y="83" width="20" height="5" rx="2.5" fill={line} />
        <rect x="114" y="60" width="52" height="38" rx="11" fill="var(--card)" stroke={line} />
        <rect x="122" y="72" width="30" height="5" rx="2.5" fill={ink} opacity=".6" />
        <rect x="122" y="83" width="20" height="5" rx="2.5" fill={line} />
        <rect x="186" y="60" width="52" height="38" rx="11" fill={soft} stroke={brand} strokeWidth="1.6" />
        <circle cx="205" cy="76" r="7" fill="none" stroke={brand} strokeWidth="2.2" />
        <path d="M210 81l6 6" stroke={brand} strokeWidth="2.2" strokeLinecap="round" />
      </g>
      <g stroke={brand} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" fill="none">
        <path d="M99 79h10M171 79h10" />
        <path d="M105 74l5 5-5 5M177 74l5 5-5 5" />
      </g>
      <rect x="48" y="112" width="96" height="6" rx="3" fill={line} />
      <rect x="156" y="112" width="60" height="6" rx="3" fill={brand} opacity=".55" />
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
