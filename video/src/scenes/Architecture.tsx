import React from "react";
import { AbsoluteFill, Audio, Img, Sequence, interpolate, staticFile, useCurrentFrame } from "remotion";
import { C, FPS, fontFamily } from "../theme";
import { ease, easeOut } from "../components/common";
import { LEAD, narration } from "../plan";

type Pt = [number, number];
type Side = "left" | "right" | "top" | "bottom";
const NW = 296;
const NH = 130;
const ARROW = 16; // arrowhead length (px); its tip sits exactly on the target card's edge
const RADIUS = 26; // corner rounding of the elbow routes

interface NodeDef {
  id: string;
  x: number; // centre
  y: number;
  title: string;
  sub: string;
  logos: string[];
  at: number; // scene-relative second the node appears
}

interface EdgeDef {
  id: string;
  from: [string, Side];
  to: [string, Side];
  label: string;
  /** which straight run of the route carries the label (default: the longest) */
  labelRun?: number;
  at: number;
  until: number;
}

interface Route {
  d: string; // the drawn line (stops where the arrowhead starts)
  pts: Pt[]; // the same route, flattened, for the travelling dots
  len: number;
  tip: Pt;
  dir: Pt;
  runs: { mid: Pt; len: number }[];
}

const dist = (a: Pt, b: Pt) => Math.hypot(b[0] - a[0], b[1] - a[1]);
const unit = (a: Pt, b: Pt): Pt => {
  const d = dist(a, b) || 1;
  return [(b[0] - a[0]) / d, (b[1] - a[1]) / d];
};

/** Axis-aligned route with rounded corners; the last run is always straight into the middle of the target edge. */
const route = (w: Pt[]): Route => {
  const tip = w[w.length - 1];
  const dir = unit(w[w.length - 2], tip);
  const end: Pt = [tip[0] - dir[0] * (ARROW - 2), tip[1] - dir[1] * (ARROW - 2)];
  const q = [...w.slice(0, -1), end];
  let d = `M${q[0][0]} ${q[0][1]}`;
  const pts: Pt[] = [q[0]];
  for (let i = 1; i < q.length - 1; i++) {
    const p = q[i];
    const r = Math.min(RADIUS, dist(q[i - 1], p) / 2, dist(p, q[i + 1]) / 2);
    const din = unit(q[i - 1], p);
    const dout = unit(p, q[i + 1]);
    const a: Pt = [p[0] - din[0] * r, p[1] - din[1] * r];
    const b: Pt = [p[0] + dout[0] * r, p[1] + dout[1] * r];
    d += ` L${a[0]} ${a[1]} Q${p[0]} ${p[1]} ${b[0]} ${b[1]}`;
    for (let k = 0; k <= 8; k++) {
      const t = k / 8;
      const u = 1 - t;
      pts.push([u * u * a[0] + 2 * u * t * p[0] + t * t * b[0], u * u * a[1] + 2 * u * t * p[1] + t * t * b[1]]);
    }
  }
  d += ` L${end[0]} ${end[1]}`;
  pts.push(end);
  let len = 0;
  for (let i = 1; i < pts.length; i++) len += dist(pts[i - 1], pts[i]);
  const runs = w.slice(1).map((p, i) => ({ mid: [(w[i][0] + p[0]) / 2, (w[i][1] + p[1]) / 2] as Pt, len: dist(w[i], p) }));
  return { d, pts, len, tip, dir, runs };
};

/** The point at a given fraction of the route's length. */
const along = (r: Route, f: number): Pt => {
  let rest = f * r.len;
  for (let i = 1; i < r.pts.length; i++) {
    const seg = dist(r.pts[i - 1], r.pts[i]);
    if (rest <= seg || i === r.pts.length - 1) {
      const k = seg ? Math.min(1, rest / seg) : 0;
      return [r.pts[i - 1][0] + (r.pts[i][0] - r.pts[i - 1][0]) * k, r.pts[i - 1][1] + (r.pts[i][1] - r.pts[i - 1][1]) * k];
    }
    rest -= seg;
  }
  return r.pts[r.pts.length - 1];
};

const BrowserGlyph: React.FC = () => (
  <svg width="54" height="54" viewBox="0 0 54 54" fill="none">
    <rect x="3" y="8" width="48" height="38" rx="7" fill="#EAF1FB" stroke="#1764E8" strokeWidth="2.6" />
    <path d="M3 18h48" stroke="#1764E8" strokeWidth="2.6" />
    <circle cx="10" cy="13" r="1.8" fill="#1764E8" />
    <circle cx="16" cy="13" r="1.8" fill="#34C9E8" />
    <rect x="10" y="25" width="20" height="4" rx="2" fill="#9DB7E3" />
    <rect x="10" y="33" width="30" height="4" rx="2" fill="#C5D5EE" />
  </svg>
);

export const Architecture: React.FC<{ frames: number }> = ({ frames }) => {
  const f = useCurrentFrame();
  const t = f / FPS;
  void frames;
  const S = narration.architecture.sentences;
  const L = LEAD / FPS;
  const s1 = L + S[0].start;
  const s2 = L + S[1].start;
  const s2d = S[1].end - S[1].start;
  const s3 = L + S[2].start;

  // Grid: four columns with equal gaps between the cards, three rows with equal spacing.
  const GAP = (1920 - 2 * 90 - 4 * NW) / 3;
  const col = (i: number) => 90 + NW / 2 + i * (NW + GAP);
  const row = (i: number) => 220 + i * 230;
  const nodes: NodeDef[] = [
    { id: "browser", x: col(0), y: row(1), title: "Your browser", sub: "Web app or installed app", logos: ["browser"], at: 0.5 },
    { id: "hosting", x: col(1), y: row(0), title: "Firebase Hosting", sub: "Serves the app, forwards /api/**", logos: ["firebase.svg"], at: s1 },
    { id: "api", x: col(2), y: row(1), title: "Cloud Run: API", sub: "Checks, limits, orchestration", logos: ["cloud-run.svg"], at: s1 + 1.2 },
    { id: "firestore", x: col(3), y: row(1), title: "Firestore", sub: "Shared scam list, checks, stats", logos: ["firestore.svg"], at: s2 },
    { id: "scanner", x: col(3), y: row(2), title: "Cloud Run: link scanner", sub: "Isolated browser, private", logos: ["cloud-run.svg"], at: s2 + s2d * 0.3 },
    { id: "gemini", x: col(3), y: row(0), title: "Gemini on Vertex AI", sub: "Structured JSON verdict", logos: ["gemini.svg", "vertex-ai.svg"], at: s2 + s2d * 0.62 },
    { id: "auth", x: col(1), y: row(2), title: "Firebase Auth", sub: "Anonymous + Google sign-in", logos: ["firebase.svg"], at: s3 },
    { id: "storage", x: col(0), y: row(2), title: "Firebase Storage", sub: "Uploads, deleted after 7 days", logos: ["firebase.svg"], at: s3 + 0.5 },
  ];
  const N = Object.fromEntries(nodes.map((n) => [n.id, n]));
  const anchor = ([id, side]: [string, Side]): Pt => {
    const n = N[id];
    return side === "left" ? [n.x - NW / 2, n.y] : side === "right" ? [n.x + NW / 2, n.y] : side === "top" ? [n.x, n.y - NH / 2] : [n.x, n.y + NH / 2];
  };
  const horizontal = (side: Side) => side === "left" || side === "right";
  /** Waypoints from the cards' own edges: straight if aligned, otherwise one elbow (or two, through the middle of the gap). */
  const waypoints = (e: EdgeDef): Pt[] => {
    const a = anchor(e.from);
    const b = anchor(e.to);
    if (a[0] === b[0] || a[1] === b[1]) return [a, b];
    if (horizontal(e.from[1]) && horizontal(e.to[1])) {
      const mx = (a[0] + b[0]) / 2;
      return [a, [mx, a[1]], [mx, b[1]], b];
    }
    return horizontal(e.from[1]) ? [a, [b[0], a[1]], b] : [a, [a[0], b[1]], b];
  };

  const edges: EdgeDef[] = [
    { id: "b-h", from: ["browser", "right"], to: ["hosting", "left"], label: "static app", at: s1 + 0.3, until: s1 + 2.2 },
    { id: "h-a", from: ["hosting", "right"], to: ["api", "left"], label: "/api/** rewrite", at: s1 + 1.4, until: s1 + 3.4 },
    { id: "a-f", from: ["api", "right"], to: ["firestore", "left"], label: "scam list", at: s2, until: s2 + s2d * 0.32 },
    { id: "a-s", from: ["api", "bottom"], to: ["scanner", "left"], label: "private call", at: s2 + s2d * 0.3, until: s2 + s2d * 0.64 },
    { id: "a-g", from: ["api", "top"], to: ["gemini", "left"], label: "structured verdict", at: s2 + s2d * 0.62, until: s2 + s2d + 0.5 },
    { id: "b-au", from: ["browser", "right"], to: ["auth", "left"], label: "sign-in", at: s3, until: s3 + 2.4 },
    { id: "b-st", from: ["browser", "bottom"], to: ["storage", "top"], label: "uploads", at: s3 + 0.5, until: s3 + 2.8 },
    { id: "a-au", from: ["api", "bottom"], to: ["auth", "right"], label: "verifies ID token", at: s3 + 0.2, until: s3 + 2.6 },
  ];

  const Node = (n: NodeDef) => {
    const a = interpolate(t, [n.at, n.at + 0.5], [0, 1], { easing: easeOut, extrapolateLeft: "clamp", extrapolateRight: "clamp" });
    if (a <= 0) return null;
    const active = interpolate(t, [n.at + 0.2, n.at + 0.8, n.at + 3.2, n.at + 4.2], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
    return (
      <div key={n.id} style={{ position: "absolute", left: n.x - NW / 2, top: n.y - NH / 2, width: NW, height: NH, opacity: a, transform: `translateY(${(1 - a) * 22}px) scale(${0.97 + 0.03 * a})`, borderRadius: 22, background: "#FFFFFF", boxShadow: `0 24px 50px rgba(0,0,0,.35), 0 0 0 ${2 + active * 2}px rgba(52,201,232,${0.15 + active * 0.7})`, display: "flex", alignItems: "center", gap: 14, padding: "0 18px" }}>
        <div style={{ display: "flex", gap: 4, alignItems: "center", minWidth: n.logos.length > 1 ? 96 : 54 }}>
          {n.logos[0] === "browser" ? <BrowserGlyph /> : n.logos.map((l) => <Img key={l} src={staticFile(`brand/${l}`)} style={{ width: n.logos.length > 1 ? 46 : 54, height: n.logos.length > 1 ? 46 : 54 }} />)}
        </div>
        <div>
          <div style={{ color: C.ink, fontWeight: 800, fontSize: 23, lineHeight: 1.15 }}>{n.title}</div>
          <div style={{ color: "#566A85", fontWeight: 500, fontSize: 16.5, marginTop: 5, lineHeight: 1.25 }}>{n.sub}</div>
        </div>
      </div>
    );
  };

  const head = interpolate(f, [2, 22], [0, 1], { easing: easeOut, extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ fontFamily }}>
      <Sequence from={LEAD}>
        <Audio src={staticFile("audio/architecture.mp3")} />
      </Sequence>
      <div style={{ position: "absolute", left: 90, top: 52, opacity: head, display: "flex", alignItems: "center", gap: 18 }}>
        <div>
          <div style={{ color: C.cyan, fontWeight: 700, fontSize: 20, letterSpacing: 3, textTransform: "uppercase" }}>How a check works</div>
          <div style={{ color: C.white, fontWeight: 800, fontSize: 40, letterSpacing: -0.8 }}>Cloud Run, Gemini, Firestore and Firebase</div>
        </div>
      </div>
      <div style={{ position: "absolute", left: 90, right: 90, bottom: 14, color: C.muted, fontWeight: 500, fontSize: 17, opacity: head }}>
        Product names and icons are trademarks of Google LLC, shown only to identify the technologies used. No endorsement or affiliation implied.
      </div>
      <svg width="1920" height="1080" style={{ position: "absolute", left: 0, top: 0 }}>
        {edges.map((e) => {
          const r = route(waypoints(e));
          const draw = interpolate(t, [e.at, e.at + 0.7], [0, 1], { easing: ease, extrapolateLeft: "clamp", extrapolateRight: "clamp" });
          if (draw <= 0) return null;
          const live = t >= e.at && t <= e.until + 1.6;
          // travelling dots follow exactly the drawn route
          const dots = [0, 1, 2].map((k) => {
            const p = (((t - e.at) * 0.55 + k / 3) % 1 + 1) % 1;
            const [x, y] = along(r, p);
            return <circle key={k} cx={x} cy={y} r={7} fill={C.cyan} opacity={live && draw >= 1 ? 0.95 * Math.sin(Math.PI * p) ** 0.6 : 0} style={{ filter: "drop-shadow(0 0 8px rgba(52,201,232,.9))" }} />;
          });
          const lab = interpolate(t, [e.at + 0.5, e.at + 1.0], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
          const head = interpolate(draw, [0.9, 1], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
          // label: centred on the middle of the longest straight run of the route, on a solid pill the line passes behind
          const run = e.labelRun !== undefined ? r.runs[e.labelRun] : r.runs.reduce((m, x) => (x.len > m.len ? x : m));
          const pw = Math.round(e.label.length * 9.8 + 30);
          const [tx, ty] = r.tip;
          const [dx, dy] = r.dir;
          const arrow = `${tx},${ty} ${tx - dx * ARROW - dy * 8},${ty - dy * ARROW + dx * 8} ${tx - dx * ARROW + dy * 8},${ty - dy * ARROW - dx * 8}`;
          const lineCol = live ? "rgba(52,201,232,.92)" : "rgba(52,201,232,.5)";
          return (
            <g key={e.id}>
              <path d={r.d} fill="none" stroke="rgba(255,255,255,.22)" strokeWidth={3} strokeLinecap="butt" strokeLinejoin="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - draw} />
              <path d={r.d} fill="none" stroke={lineCol} strokeWidth={live ? 3.4 : 2.4} strokeLinecap="butt" strokeLinejoin="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - draw} />
              <polygon points={arrow} fill={lineCol} opacity={head} />
              {dots}
              <g opacity={lab}>
                <rect x={run.mid[0] - pw / 2} y={run.mid[1] - 18} width={pw} height={36} rx={18} fill="#0A2038" stroke="rgba(52,201,232,.55)" strokeWidth={1.5} />
                <text x={run.mid[0]} y={run.mid[1]} textAnchor="middle" dominantBaseline="central" fill={C.soft} fontFamily={fontFamily} fontWeight={600} fontSize={18}>
                  {e.label}
                </text>
              </g>
            </g>
          );
        })}
      </svg>
      {nodes.map(Node)}
      {/* the suspicious website the scanner opens */}
      {(() => {
        const a = interpolate(t, [s2 + s2d * 0.45, s2 + s2d * 0.45 + 0.6], [0, 1], { easing: easeOut, extrapolateLeft: "clamp", extrapolateRight: "clamp" });
        return (
          <div style={{ position: "absolute", left: N.scanner.x - 165, top: N.scanner.y + NH / 2 + 48, width: 330, opacity: a, transform: `translateY(${(1 - a) * 12}px)` }}>
            <div style={{ position: "absolute", left: 165 - 1.5, top: -50, width: 3, height: 46, background: "rgba(229,72,77,.7)", borderRadius: 2 }} />
            <div style={{ padding: "12px 18px", borderRadius: 16, background: "rgba(229,72,77,.14)", border: "1.5px dashed rgba(229,72,77,.75)", color: C.white, fontWeight: 600, fontSize: 19, textAlign: "center", lineHeight: 1.3 }}>
              The suspicious website
              <div style={{ color: C.soft, fontWeight: 500, fontSize: 16, marginTop: 3 }}>through a validated proxy only</div>
            </div>
          </div>
        );
      })()}
    </AbsoluteFill>
  );
};
