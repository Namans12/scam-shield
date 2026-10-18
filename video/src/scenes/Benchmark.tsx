import React from "react";
import { AbsoluteFill, Audio, Sequence, interpolate, staticFile, useCurrentFrame } from "remotion";
import { C, FPS, fontFamily } from "../theme";
import { ease, easeOut } from "../components/common";
import { LEAD, narration } from "../plan";
import bench from "../generated/bench.json";

const Metric: React.FC<{ label: string; value: number; sub: string; good: boolean; at: number; accent: string }> = ({ label, value, sub, good, at, accent }) => {
  const f = useCurrentFrame();
  const a = interpolate(f, [at, at + 18], [0, 1], { easing: easeOut, extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const v = interpolate(f, [at + 6, at + 6 + 54], [0, value], { easing: ease, extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <div style={{ width: 470, padding: "34px 36px 32px", borderRadius: 28, background: "linear-gradient(160deg, rgba(255,255,255,.10), rgba(255,255,255,.04))", border: "1px solid rgba(255,255,255,.14)", boxShadow: "0 24px 60px rgba(0,0,0,.30)", opacity: a, transform: `translateY(${(1 - a) * 28}px)` }}>
      <div style={{ color: C.muted, fontWeight: 700, fontSize: 24, letterSpacing: 2.4, textTransform: "uppercase" }}>{label}</div>
      <div style={{ marginTop: 14, color: accent, fontWeight: 800, fontSize: 112, letterSpacing: -3, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>
        {v.toFixed(1)}
        <span style={{ fontSize: 64, color: C.soft }}>%</span>
      </div>
      <div style={{ marginTop: 16, color: C.soft, fontWeight: 600, fontSize: 28, opacity: interpolate(f, [at + 56, at + 70], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) }}>{sub}</div>
      <div style={{ marginTop: 14, height: 8, borderRadius: 4, background: "rgba(255,255,255,.12)", overflow: "hidden" }}>
        <div style={{ width: `${good ? v : 100 - v}%`, height: "100%", background: accent, borderRadius: 4 }} />
      </div>
    </div>
  );
};

export const Benchmark: React.FC<{ frames: number }> = ({ frames }) => {
  const f = useCurrentFrame();
  void frames;
  const s1 = LEAD + Math.round(narration.benchmark.sentences[0].start * FPS);
  const s2 = LEAD + Math.round(narration.benchmark.sentences[1].start * FPS);
  const head = interpolate(f, [4, 24], [0, 1], { easing: easeOut, extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const cave = interpolate(f, [s2 - 6, s2 + 14], [0, 1], { easing: easeOut, extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const b = bench;
  const at = s1 + 4;
  return (
    <AbsoluteFill style={{ fontFamily }}>
      <Sequence from={LEAD}>
        <Audio src={staticFile("audio/benchmark.mp3")} />
      </Sequence>
      <div style={{ position: "absolute", left: 0, right: 0, top: 70, textAlign: "center", opacity: head, transform: `translateY(${(1 - head) * 16}px)` }}>
        <div style={{ color: C.cyan, fontWeight: 700, fontSize: 24, letterSpacing: 3.2, textTransform: "uppercase" }}>Evaluation on the live app</div>
        <div style={{ marginTop: 12, color: C.white, fontWeight: 800, fontSize: 60, letterSpacing: -1.2 }}>
          {b.cases} synthetic cases: {b.scams} scams, {b.genuine} genuine{b.ambiguous ? `, ${b.ambiguous} ambiguous` : ""}
        </div>
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, top: 285, display: "flex", justifyContent: "center", gap: 36 }}>
        <Metric label="Accuracy" value={b.accuracy} sub={`${b.correct} of ${b.scored} scored correct`} good accent={C.cyan} at={at} />
        <Metric label="Scam recall" value={b.recall} sub={`${b.scamsFlagged} of ${b.scams} scams flagged`} good accent={C.cyan} at={at + 8} />
        <Metric label="False positives" value={b.falsePositive} sub={`${b.genuineFlagged} of ${b.genuine} genuine flagged`} good={false} accent={C.green} at={at + 16} />
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, top: 668, display: "flex", justifyContent: "center", gap: 18, opacity: interpolate(f, [at + 40, at + 60], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) }}>
        {[`Scam type correct: ${b.scamType}%`, `Text checks, median: ${b.textP50} s`, `Errors: ${b.errors}`, "Flagged = Scam or Suspicious"].map((t) => (
          <div key={t} style={{ padding: "10px 20px", borderRadius: 999, background: "rgba(255,255,255,.08)", border: "1px solid rgba(255,255,255,.14)", color: C.soft, fontWeight: 600, fontSize: 24 }}>
            {t}
          </div>
        ))}
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, top: 770, display: "flex", justifyContent: "center", opacity: cave, transform: `translateY(${(1 - cave) * 16}px)` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 18, padding: "18px 34px", borderRadius: 20, background: "rgba(245,184,61,.14)", border: "1px solid rgba(245,184,61,.55)", color: C.white, fontWeight: 600, fontSize: 30 }}>
          <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke={C.amber} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 3 2 21h20z" />
            <path d="M12 10v5M12 18.2v.1" />
          </svg>
          A small test, not a guarantee. AI can make mistakes: pause and verify when in doubt.
        </div>
      </div>
    </AbsoluteFill>
  );
};
