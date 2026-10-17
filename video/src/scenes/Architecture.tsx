import React from "react";
import { AbsoluteFill, Audio, Img, Sequence, interpolate, staticFile, useCurrentFrame } from "remotion";
import { C, FPS, fontFamily } from "../theme";
import { ease, easeOut } from "../components/common";
import { LEAD, narration } from "../plan";

type Pt = [number, number];
const NW = 310;
const NH = 124;

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
  from: Pt;
  to: Pt;
  c1?: Pt;
  c2?: Pt;
  label: string;
  at: number;
  until: number;
  lx?: number;
  ly?: number;
}

const bez = (p0: Pt, c1: Pt, c2: Pt, p1: Pt, t: number): Pt => {
  const u = 1 - t;
  return [u * u * u * p0[0] + 3 * u * u * t * c1[0] + 3 * u * t * t * c2[0] + t * t * t * p1[0], u * u * u * p0[1] + 3 * u * u * t * c1[1] + 3 * u * t * t * c2[1] + t * t * t * p1[1]];
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

  const nodes: NodeDef[] = [
    { id: "browser", x: 230, y: 520, title: "Your browser", sub: "Web app or installed app", logos: ["browser"], at: 0.5 },
    { id: "hosting", x: 650, y: 270, title: "Firebase Hosting", sub: "Serves the app, forwards /api/**", logos: ["firebase.svg"], at: s1 },
    { id: "api", x: 1100, y: 430, title: "Cloud Run: API", sub: "Checks, limits, orchestration", logos: ["cloud-run.svg"], at: s1 + 1.2 },
    { id: "firestore", x: 1590, y: 430, title: "Firestore", sub: "Shared scam list, checks, stats", logos: ["firestore.svg"], at: s2 },
    { id: "scanner", x: 1590, y: 660, title: "Cloud Run: link scanner", sub: "Isolated browser, private", logos: ["cloud-run.svg"], at: s2 + s2d * 0.3 },
    { id: "gemini", x: 1590, y: 200, title: "Gemini on Vertex AI", sub: "Structured JSON verdict", logos: ["gemini.svg", "vertex-ai.svg"], at: s2 + s2d * 0.62 },
    { id: "auth", x: 650, y: 570, title: "Firebase Auth", sub: "Anonymous + Google sign-in", logos: ["firebase.svg"], at: s3 },
    { id: "storage", x: 650, y: 800, title: "Firebase Storage", sub: "Uploads, deleted after 7 days", logos: ["firebase.svg"], at: s3 + 0.5 },
  ];
  const N = Object.fromEntries(nodes.map((n) => [n.id, n]));
  const right = (id: string): Pt => [N[id].x + NW / 2, N[id].y];
  const left = (id: string): Pt => [N[id].x - NW / 2, N[id].y];
  const bottom = (id: string): Pt => [N[id].x, N[id].y + NH / 2];
  const top = (id: string): Pt => [N[id].x, N[id].y - NH / 2];

  const edges: EdgeDef[] = [
    { id: "b-h", from: right("browser"), to: left("hosting"), c1: [420, 520], c2: [440, 270], label: "static app", at: s1 + 0.3, until: s1 + 2.2, lx: 395, ly: 360 },
    { id: "h-a", from: right("hosting"), to: left("api"), c1: [900, 270], c2: [900, 430], label: "/api/** rewrite", at: s1 + 1.4, until: s1 + 3.4, lx: 835, ly: 296 },
    { id: "a-f", from: right("api"), to: left("firestore"), label: "scam list", at: s2, until: s2 + s2d * 0.32, lx: 1280, ly: 400 },
    { id: "a-s", from: bottom("api"), to: left("scanner"), c1: [1100, 660], c2: [1300, 660], label: "private call", at: s2 + s2d * 0.3, until: s2 + s2d * 0.64, lx: 1180, ly: 632 },
    { id: "a-g", from: top("api"), to: left("gemini"), c1: [1100, 200], c2: [1300, 200], label: "structured verdict", at: s2 + s2d * 0.62, until: s2 + s2d + 0.5, lx: 1190, ly: 168 },
    { id: "b-au", from: [N.browser.x, N.browser.y + NH / 2], to: left("auth"), c1: [230, 700], c2: [380, 560], label: "sign-in", at: s3, until: s3 + 2.4, lx: 300, ly: 700 },
    { id: "b-st", from: [N.browser.x + 40, N.browser.y + NH / 2], to: left("storage"), c1: [320, 800], c2: [420, 790], label: "uploads", at: s3 + 0.5, until: s3 + 2.8, lx: 380, ly: 850 },
    { id: "a-au", from: [N.api.x - 80, N.api.y + NH / 2], to: right("auth"), c1: [1000, 560], c2: [900, 560], label: "verifies ID token", at: s3 + 0.2, until: s3 + 2.6, lx: 880, ly: 525 },
  ];

  const Node = (n: NodeDef) => {
    const a = interpolate(t, [n.at, n.at + 0.5], [0, 1], { easing: easeOut, extrapolateLeft: "clamp", extrapolateRight: "clamp" });
    if (a <= 0) return null;
    const active = interpolate(t, [n.at + 0.2, n.at + 0.8, n.at + 3.2, n.at + 4.2], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
    return (
      <div key={n.id} style={{ position: "absolute", left: n.x - NW / 2, top: n.y - NH / 2, width: NW, height: NH, opacity: a, transform: `translateY(${(1 - a) * 22}px) scale(${0.97 + 0.03 * a})`, borderRadius: 22, background: "#FFFFFF", boxShadow: `0 24px 50px rgba(0,0,0,.35), 0 0 0 ${2 + active * 2}px rgba(52,201,232,${0.15 + active * 0.7})`, display: "flex", alignItems: "center", gap: 16, padding: "0 20px" }}>
        <div style={{ display: "flex", gap: 4, alignItems: "center", minWidth: n.logos.length > 1 ? 96 : 54 }}>
          {n.logos[0] === "browser" ? <BrowserGlyph /> : n.logos.map((l) => <Img key={l} src={staticFile(`brand/${l}`)} style={{ width: n.logos.length > 1 ? 46 : 54, height: n.logos.length > 1 ? 46 : 54 }} />)}
        </div>
        <div>
          <div style={{ color: C.ink, fontWeight: 800, fontSize: 24, lineHeight: 1.15 }}>{n.title}</div>
          <div style={{ color: "#566A85", fontWeight: 500, fontSize: 17, marginTop: 5, lineHeight: 1.25 }}>{n.sub}</div>
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
      <div style={{ position: "absolute", left: 90, right: 90, bottom: 22, color: C.muted, fontWeight: 500, fontSize: 17, opacity: head }}>
        Product names and icons are trademarks of Google LLC, shown only to identify the technologies used. No endorsement or affiliation implied.
      </div>
      <svg width="1920" height="1080" style={{ position: "absolute", left: 0, top: 0 }}>
        <defs>
          <marker id="arr" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0 0L10 5L0 10z" fill={C.cyan} />
          </marker>
        </defs>
        {edges.map((e) => {
          const c1 = e.c1 ?? [e.from[0] + (e.to[0] - e.from[0]) / 3, e.from[1] + (e.to[1] - e.from[1]) / 3];
          const c2 = e.c2 ?? [e.from[0] + (2 * (e.to[0] - e.from[0])) / 3, e.from[1] + (2 * (e.to[1] - e.from[1])) / 3];
          const draw = interpolate(t, [e.at, e.at + 0.7], [0, 1], { easing: ease, extrapolateLeft: "clamp", extrapolateRight: "clamp" });
          if (draw <= 0) return null;
          const d = `M${e.from[0]} ${e.from[1]} C${c1[0]} ${c1[1]} ${c2[0]} ${c2[1]} ${e.to[0]} ${e.to[1]}`;
          const live = t >= e.at && t <= e.until + 1.6;
          // travelling dots
          const dots = [0, 1, 2].map((k) => {
            const p = (((t - e.at) * 0.55 + k / 3) % 1 + 1) % 1;
            const [x, y] = bez(e.from, c1 as Pt, c2 as Pt, e.to, p);
            return <circle key={k} cx={x} cy={y} r={7} fill={C.cyan} opacity={live && draw >= 1 ? 0.95 * Math.sin(Math.PI * p) ** 0.6 : 0} style={{ filter: "drop-shadow(0 0 8px rgba(52,201,232,.9))" }} />;
          });
          const lab = interpolate(t, [e.at + 0.5, e.at + 1.0], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
          return (
            <g key={e.id}>
              <path d={d} fill="none" stroke="rgba(255,255,255,.22)" strokeWidth={3} strokeLinecap="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - draw} />
              <path d={d} fill="none" stroke={C.cyan} strokeWidth={live ? 3.4 : 2.2} strokeOpacity={live ? 0.9 : 0.4} strokeLinecap="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - draw} markerEnd={draw >= 0.98 ? "url(#arr)" : undefined} />
              {dots}
              {e.lx !== undefined ? (
                <g opacity={lab}>
                  <rect x={e.lx - 8} y={(e.ly ?? 0) - 24} width={e.label.length * 11.6 + 22} height={34} rx={12} fill="rgba(8,27,50,.94)" stroke="rgba(52,201,232,.5)" />
                  <text x={e.lx + 3} y={(e.ly ?? 0) - 1} fill={C.soft} fontFamily={fontFamily} fontWeight={600} fontSize={19}>
                    {e.label}
                  </text>
                </g>
              ) : null}
            </g>
          );
        })}
      </svg>
      {nodes.map(Node)}
      {/* the suspicious website the scanner opens */}
      {(() => {
        const a = interpolate(t, [s2 + s2d * 0.45, s2 + s2d * 0.45 + 0.6], [0, 1], { easing: easeOut, extrapolateLeft: "clamp", extrapolateRight: "clamp" });
        return (
          <div style={{ position: "absolute", left: 1590 - 165, top: 800, width: 330, opacity: a, transform: `translateY(${(1 - a) * 12}px)` }}>
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
