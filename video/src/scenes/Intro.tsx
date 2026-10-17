import React from "react";
import { AbsoluteFill, Audio, Img, Sequence, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { C, FPS, fontFamily } from "../theme";
import { ease, easeOut } from "../components/common";
import { LEAD, narration } from "../plan";

/** Logo reveal, then the one statistic: Rs 19,813 crore reported lost in 2025 (I4C data, sources.md). */
export const Intro: React.FC<{ frames: number }> = ({ frames }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = f / FPS;
  const s2 = LEAD + Math.round(narration.intro.sentences[1].start * FPS); // second sentence starts
  const logo = spring({ frame: f - 4, fps, config: { damping: 18, stiffness: 90, mass: 0.9 } });
  const word = interpolate(f, [16, 34], [0, 1], { easing: easeOut, extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const statIn = interpolate(f, [34, 52], [0, 1], { easing: easeOut, extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const count = interpolate(f, [40, 40 + 60], [0, 19813], { easing: ease, extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const logoUp = interpolate(f, [26, 56], [0, -150], { easing: ease, extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const logoScale = interpolate(f, [26, 56], [1, 0.62], { easing: ease, extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const swap = interpolate(f, [s2 - 14, s2 + 6], [0, 1], { easing: ease, extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const tag = interpolate(f, [s2 + 2, s2 + 22], [0, 1], { easing: easeOut, extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const num = Math.round(count).toLocaleString("en-IN");
  void t;
  return (
    <AbsoluteFill style={{ fontFamily }}>
      <Sequence from={LEAD}>
        <Audio src={staticFile("audio/intro.mp3")} />
      </Sequence>
      {/* logo */}
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", transform: `translateY(${logoUp}px) scale(${logoScale})` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 34, opacity: 1 - swap * 0.0 }}>
          <div style={{ width: 210, height: 210, transform: `scale(${0.6 + 0.4 * logo}) rotate(${(1 - logo) * -14}deg)`, opacity: logo, filter: "drop-shadow(0 20px 50px rgba(52,201,232,.35))" }}>
            <Img src={staticFile("brand/mark-on-dark.svg")} style={{ width: "100%", height: "100%" }} />
          </div>
          <div style={{ opacity: word, transform: `translateX(${(1 - word) * -24}px)`, color: C.white, fontWeight: 800, fontSize: 124, letterSpacing: -3 }}>
            Scam <span style={{ color: C.cyan }}>Shield</span>
          </div>
        </div>
      </AbsoluteFill>
      {/* statistic */}
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", paddingTop: 250, opacity: statIn * (1 - swap), transform: `translateY(${(1 - statIn) * 26 - swap * 18}px)` }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ color: C.white, fontWeight: 800, fontSize: 150, letterSpacing: -4, fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>
            <span style={{ color: C.cyan }}>₹</span>
            {num} <span style={{ fontSize: 96, fontWeight: 700, color: C.soft }}>crore</span>
          </div>
          <div style={{ marginTop: 22, color: C.soft, fontWeight: 600, fontSize: 40 }}>reported lost to cyber fraud in India in 2025</div>
          <div style={{ marginTop: 18, color: C.muted, fontWeight: 500, fontSize: 26 }}>I4C data (National Cyber Crime Reporting Portal) · about 21.8 lakh complaints</div>
        </div>
      </AbsoluteFill>
      {/* tagline */}
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", paddingTop: 250, opacity: tag, transform: `translateY(${(1 - tag) * 20}px)` }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ color: C.white, fontWeight: 800, fontSize: 92, letterSpacing: -2 }}>
            Check what you were sent,
            <br />
            <span style={{ color: C.cyan }}>before you act.</span>
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
