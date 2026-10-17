import React from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";
import { C, W, H, fontFamily } from "../theme";

export const ease = Easing.bezier(0.45, 0, 0.15, 1);
export const easeOut = Easing.bezier(0.16, 1, 0.3, 1);

/** The calm navy backdrop shared by every scene. */
export const Backdrop: React.FC = () => (
  <AbsoluteFill style={{ background: `radial-gradient(1400px 800px at 50% 0%, ${C.navy2} 0%, ${C.navy} 70%)` }}>
    <AbsoluteFill style={{ background: `radial-gradient(700px 500px at 12% 100%, rgba(23,100,232,.22), transparent 70%), radial-gradient(600px 420px at 92% 8%, rgba(52,201,232,.14), transparent 70%)` }} />
    <AbsoluteFill style={{ opacity: 0.5, backgroundImage: "linear-gradient(rgba(255,255,255,.035) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.035) 1px, transparent 1px)", backgroundSize: "64px 64px", maskImage: "radial-gradient(900px 600px at 50% 40%, #000 20%, transparent 100%)", WebkitMaskImage: "radial-gradient(900px 600px at 50% 40%, #000 20%, transparent 100%)" }} />
  </AbsoluteFill>
);

/** Fades a scene in and out so scenes dissolve into one another. */
export const SceneFade: React.FC<{ frames: number; overlap: number; children: React.ReactNode; first?: boolean; last?: boolean }> = ({ frames, overlap, children, first, last }) => {
  const f = useCurrentFrame();
  const a = first ? 1 : interpolate(f, [0, overlap], [0, 1], { easing: ease, extrapolateRight: "clamp" });
  const b = last ? 1 : interpolate(f, [frames - overlap, frames], [1, 0], { easing: ease, extrapolateLeft: "clamp" });
  const lift = first ? 0 : interpolate(f, [0, overlap + 6], [14, 0], { easing: easeOut, extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ opacity: Math.min(a, b), transform: `translateY(${lift}px)` }}>{children}</AbsoluteFill>
  );
};

export const Pill: React.FC<{ children: React.ReactNode; bg?: string; color?: string; style?: React.CSSProperties }> = ({ children, bg = "rgba(8,27,50,.86)", color = C.white, style }) => (
  <div style={{ display: "inline-flex", alignItems: "center", gap: 10, padding: "10px 18px", borderRadius: 999, background: bg, color, fontFamily, fontWeight: 600, fontSize: 22, letterSpacing: 0.1, boxShadow: "0 8px 24px rgba(0,0,0,.28)", ...style }}>{children}</div>
);

export const Center: React.FC<{ children: React.ReactNode; style?: React.CSSProperties }> = ({ children, style }) => (
  <AbsoluteFill style={{ width: W, height: H, display: "flex", alignItems: "center", justifyContent: "center", ...style }}>{children}</AbsoluteFill>
);
