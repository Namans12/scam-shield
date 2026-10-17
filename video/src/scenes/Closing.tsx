import React from "react";
import { AbsoluteFill, Audio, Img, Sequence, interpolate, staticFile, useCurrentFrame } from "remotion";
import { C, fontFamily } from "../theme";
import { ease, easeOut } from "../components/common";
import { LEAD } from "../plan";

const LOGOS = [
  { f: "gemini.svg", n: "Gemini" },
  { f: "vertex-ai.svg", n: "Vertex AI" },
  { f: "cloud-run.svg", n: "Cloud Run" },
  { f: "firestore.svg", n: "Firestore" },
  { f: "firebase.svg", n: "Firebase" },
];

export const Closing: React.FC<{ frames: number }> = ({ frames }) => {
  const f = useCurrentFrame();
  const a = (from: number, d = 18) => interpolate(f, [from, from + d], [0, 1], { easing: easeOut, extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  void ease;
  void frames;
  return (
    <AbsoluteFill style={{ fontFamily, alignItems: "center", justifyContent: "center" }}>
      <Sequence from={LEAD}>
        <Audio src={staticFile("audio/closing.mp3")} />
      </Sequence>
      <div style={{ textAlign: "center", marginTop: -50 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 28, opacity: a(0), transform: `translateY(${(1 - a(0)) * 18}px)` }}>
          <Img src={staticFile("brand/mark-on-dark.svg")} style={{ width: 150, height: 150, filter: "drop-shadow(0 16px 40px rgba(52,201,232,.35))" }} />
          <div style={{ color: C.white, fontWeight: 800, fontSize: 112, letterSpacing: -3 }}>
            Scam <span style={{ color: C.cyan }}>Shield</span>
          </div>
        </div>
        <div style={{ marginTop: 34, color: C.white, fontWeight: 700, fontSize: 56, opacity: a(14), transform: `translateY(${(1 - a(14)) * 14}px)` }}>Check before you click, pay or scan.</div>
        <div style={{ marginTop: 44, display: "inline-flex", flexDirection: "column", gap: 14, alignItems: "flex-start", opacity: a(30) }}>
          <Row label="Live app" value="project-91260b43-6705-4176-b71.web.app" />
          <Row label="Code" value="github.com/Namans12/scam-shield" />
        </div>
        <div style={{ marginTop: 50, display: "flex", justifyContent: "center", alignItems: "center", gap: 26, opacity: a(46) }}>
          <span style={{ color: C.muted, fontWeight: 600, fontSize: 22, letterSpacing: 2.4, textTransform: "uppercase" }}>Built on Google Cloud</span>
          {LOGOS.map((l) => (
            <div key={l.f} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 16px", borderRadius: 14, background: "rgba(255,255,255,.95)" }}>
              <Img src={staticFile(`brand/${l.f}`)} style={{ width: 30, height: 30 }} />
              <span style={{ color: C.ink, fontWeight: 600, fontSize: 20 }}>{l.n}</span>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 28, color: C.muted, fontWeight: 500, fontSize: 22, opacity: a(56) }}>Guidance only, not a police or legal service. Lost money? Call 1930.</div>
      </div>
    </AbsoluteFill>
  );
};

const Row: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div style={{ display: "flex", alignItems: "baseline", gap: 22 }}>
    <span style={{ width: 150, textAlign: "right", color: C.muted, fontWeight: 600, fontSize: 24, letterSpacing: 2, textTransform: "uppercase" }}>{label}</span>
    <span style={{ color: C.white, fontWeight: 700, fontSize: 40 }}>{value}</span>
  </div>
);
