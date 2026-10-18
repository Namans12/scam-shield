import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { C, CAPTION_BOTTOM, FPS, fontFamily } from "../theme";
import { LEAD, narration, sceneStarts } from "../plan";
import { ease } from "./common";

export interface CaptionCue {
  from: number; // absolute frame
  to: number;
  text: string;
}

/** One caption per narrated sentence, timed from the measured audio (not estimated). */
export function captionCues(): CaptionCue[] {
  const cues: CaptionCue[] = [];
  for (const { id, start } of sceneStarts()) {
    for (const s of narration[id].sentences) {
      cues.push({ from: start + LEAD + Math.round(s.start * FPS), to: start + LEAD + Math.round(s.end * FPS), text: s.caption });
    }
  }
  return cues;
}

export const Captions: React.FC = () => {
  const f = useCurrentFrame();
  const cues = React.useMemo(captionCues, []);
  const cue = cues.find((c) => f >= c.from - 2 && f <= c.to + 8);
  if (!cue) return null;
  const a = interpolate(f, [cue.from - 2, cue.from + 6, cue.to + 2, cue.to + 8], [0, 1, 1, 0], { easing: ease, extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const y = interpolate(f, [cue.from - 2, cue.from + 8], [8, 0], { easing: ease, extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ justifyContent: "flex-end", alignItems: "center", paddingBottom: CAPTION_BOTTOM, pointerEvents: "none" }}>
      <div
        style={{
          opacity: a,
          transform: `translateY(${y}px)`,
          maxWidth: 1460,
          padding: "16px 34px 18px",
          borderRadius: 20,
          background: "rgba(5,16,30,.82)",
          border: "1px solid rgba(255,255,255,.10)",
          boxShadow: "0 14px 40px rgba(0,0,0,.38)",
          color: C.white,
          fontFamily,
          fontWeight: 600,
          fontSize: 36,
          lineHeight: 1.28,
          textAlign: "center",
          letterSpacing: 0.1,
          textWrap: "balance" as never,
        }}
      >
        {cue.text.split(" ").map((w, i, a) => (
          <React.Fragment key={i}>
            {w.includes("-") ? <span style={{ whiteSpace: "nowrap" }}>{w}</span> : w}
            {i < a.length - 1 ? " " : ""}
          </React.Fragment>
        ))}
      </div>
    </AbsoluteFill>
  );
};
