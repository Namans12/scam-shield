import React from "react";
import { AbsoluteFill, Audio, Img, OffthreadVideo, Sequence, staticFile, useCurrentFrame, interpolate } from "remotion";
import { BASE, C, FPS, WIN, fontFamily } from "../theme";
import { ease, easeOut, Pill } from "../components/common";
import holds from "../generated/holds.json";
import { layout, sceneTime, type Cam, type LaidSeg, type Plan, type Ring, LEAD } from "../plan";

const NATIVE = { desktop: { w: 1440, h: 900 }, phone: { w: 390, h: 844 } } as const;

/** Where the recorded screen sits on the 1920x1080 stage. */
function geo(device: Plan["device"]) {
  if (device === "phone") return { x: 785, y: 66, w: 351, h: 760, scale: 0.9 };
  return { x: WIN.x, y: WIN.y + WIN.chrome, w: WIN.w, h: WIN.h, scale: BASE };
}

interface Pose {
  cx: number;
  cy: number;
  s: number;
  top: number;
}
type CamKey = { t: number; cx: number; cy: number; s: number; dur: number; top: number };
function poseAt(cams: CamKey[], t: number): Pose {
  let cur = cams[0];
  let pose: Pose = { cx: cur.cx, cy: cur.cy, s: cur.s, top: cur.top };
  for (let i = 1; i < cams.length; i++) {
    const n = cams[i];
    const start = n.t - n.dur;
    if (t >= n.t) {
      pose = { cx: n.cx, cy: n.cy, s: n.s, top: n.top };
      cur = n;
    } else if (t > start) {
      const k = ease((t - start) / n.dur);
      pose = { cx: cur.cx + (n.cx - cur.cx) * k, cy: cur.cy + (n.cy - cur.cy) * k, s: cur.s + (n.s - cur.s) * k, top: cur.top + (n.top - cur.top) * k };
      break;
    } else break;
  }
  return pose;
}

/** Maps a point in the recorded screen to stage pixels for a camera pose. */
function project(device: Plan["device"], pose: Pose, fx: number, fy: number) {
  const g = geo(device);
  const n = NATIVE[device];
  const S = g.scale * pose.s;
  const tx = Math.min(0, Math.max(g.w - n.w * S, g.w / 2 - pose.cx * S));
  const ty = Math.min(0, Math.max(g.h - n.h * S, g.h / 2 - pose.cy * S));
  return { S, tx, ty, x: g.x + tx + fx * S, y: g.y + ty + fy * S };
}

const Chrome: React.FC<{ url: string; live: string }> = ({ url, live }) => (
  <div style={{ height: WIN.chrome, background: "linear-gradient(#EEF1F6,#E4E9F1)", display: "flex", alignItems: "center", padding: "0 16px", gap: 14, borderBottom: "1px solid #D2D9E4" }}>
    <div style={{ display: "flex", gap: 8 }}>
      {["#FF6058", "#FFBD2E", "#27C93F"].map((c) => (
        <span key={c} style={{ width: 12, height: 12, borderRadius: 6, background: c, display: "block" }} />
      ))}
    </div>
    <div style={{ flex: 1, display: "flex", justifyContent: "center" }}>
      <div style={{ minWidth: 560, height: 28, borderRadius: 14, background: "#fff", border: "1px solid #D9E0EA", display: "flex", alignItems: "center", gap: 8, padding: "0 14px", fontFamily, fontSize: 14, color: "#4B5B70" }}>
        <svg width="12" height="14" viewBox="0 0 12 14" fill="none">
          <rect x="1.5" y="6" width="9" height="7" rx="1.6" fill="#7B8AA0" />
          <path d="M3.6 6V4.2a2.4 2.4 0 0 1 4.8 0V6" stroke="#7B8AA0" strokeWidth="1.5" fill="none" />
        </svg>
        <span>
          project-91260b43-6705-4176-b71.web.app<span style={{ color: "#0B1B32", fontWeight: 600 }}>{url === "/" ? "" : url}</span>
        </span>
      </div>
    </div>
    <div style={{ display: "flex", alignItems: "center", gap: 8, fontFamily, fontSize: 13, fontWeight: 600, color: "#2F4058", background: "#fff", border: "1px solid #D9E0EA", borderRadius: 999, padding: "4px 12px" }}>
      <span style={{ width: 8, height: 8, borderRadius: 4, background: "#E5484D", boxShadow: "0 0 0 3px rgba(229,72,77,.18)" }} />
      {live}
    </div>
  </div>
);

const fmtClock = (sec: number) => {
  const t = Math.max(0, sec);
  const m = Math.floor(t / 60);
  const r = t - m * 60;
  return `${m}:${r.toFixed(1).padStart(4, "0")}`;
};

/**
 * Fast-forward panel: chevrons that light up and run faster with the speed (2x, 3x, 4x, then back down), the real-time clock racing,
 * and a progress bar for the real wait. Everything is derived from the segments, so it always matches what is playing.
 */
const SpeedPanel: React.FC<{ segs: LaidSeg[]; frame: number; phone: boolean }> = ({ segs, frame, phone }) => {
  const ff = segs.filter((x) => x.ff);
  if (!ff.length) return null;
  const first = ff[0];
  const last = ff[ff.length - 1];
  const gStart = first.start;
  const gEnd = last.start + last.frames;
  if (frame < gStart - 2 || frame > gEnd + 14) return null;
  const cur = ff.find((x) => frame >= x.start && frame < x.start + x.frames) ?? (frame < gStart ? first : last);
  const rate = cur.rate ?? 1;
  const f = Math.min(Math.max(frame, cur.start), cur.start + cur.frames);
  const clipT = cur.from + ((f - cur.start) / FPS) * rate;
  const total = last.to - first.from;
  const elapsed = Math.min(Math.max(clipT - first.from, 0), total);
  const prog = frame > gEnd ? 1 : elapsed / total;
  const a = interpolate(frame, [gStart - 2, gStart + 8, gEnd + 2, gEnd + 14], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const phase = (frame * rate * 0.035) % 1;
  const chevrons = [0, 1, 2].map((i) => {
    const lit = rate >= [2, 3, 4][i];
    const wave = 0.5 + 0.5 * Math.sin(2 * Math.PI * (phase - i / 3));
    return (
      <svg key={i} width="22" height="34" viewBox="0 0 22 34" style={{ opacity: lit ? 0.45 + 0.55 * wave : 0.2, marginLeft: i ? -6 : 0 }}>
        <path d="M4 3l14 14L4 31" fill="none" stroke={C.amber} strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  });
  const pos: React.CSSProperties = phone ? { left: 1186, top: 150 } : { left: WIN.x + WIN.w / 2, top: WIN.y + WIN.chrome + 16, transform: "translateX(-50%)" };
  return (
    <>
      <div style={{ position: "absolute", ...(phone ? { left: 785, top: 66, width: 351, height: 760, borderRadius: 40 } : { left: WIN.x, top: WIN.y + WIN.chrome, width: WIN.w, height: WIN.h, borderRadius: "0 0 18px 18px" }), opacity: a, pointerEvents: "none", boxShadow: `inset 0 0 0 4px rgba(245,184,61,${0.55 + 0.25 * Math.sin(frame / 4)}), inset 0 0 70px rgba(245,184,61,.22)` }} />
      <div style={{ position: "absolute", ...pos, opacity: a, fontFamily }}>
        <div style={{ position: "relative", overflow: "hidden", display: "flex", alignItems: "center", gap: 24, padding: "12px 28px 18px 24px", borderRadius: 22, background: "rgba(8,27,50,.94)", border: "2px solid rgba(245,184,61,.85)", boxShadow: "0 16px 44px rgba(0,0,0,.4)", color: C.white, whiteSpace: "nowrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ display: "flex", alignItems: "center", width: 56 }}>{chevrons}</div>
            <div style={{ color: C.amber, fontWeight: 800, fontSize: 52, letterSpacing: -1.5, lineHeight: 1, minWidth: 66, fontVariantNumeric: "tabular-nums" }}>{rate}x</div>
          </div>
          <div>
            <div style={{ color: C.amber, fontWeight: 800, fontSize: 15, letterSpacing: 3 }}>FAST-FORWARD</div>
            <div style={{ fontWeight: 600, fontSize: 22, marginTop: 3 }}>Waiting for the check</div>
          </div>
          <div style={{ width: 2, alignSelf: "stretch", background: "rgba(255,255,255,.16)" }} />
          <div>
            <div style={{ color: C.muted, fontWeight: 700, fontSize: 15, letterSpacing: 3 }}>REAL TIME</div>
            <div style={{ fontWeight: 800, fontSize: 38, lineHeight: 1.05, marginTop: 1, fontVariantNumeric: "tabular-nums", minWidth: 118 }}>{fmtClock(elapsed)}</div>
          </div>
          <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 7, background: "rgba(255,255,255,.12)" }}>
            <div style={{ width: `${prog * 100}%`, height: "100%", background: `repeating-linear-gradient(115deg, ${C.amber} 0 12px, #FFD27A 12px 24px)`, backgroundPosition: `${frame * rate}px 0` }} />
          </div>
        </div>
      </div>
    </>
  );
};

const LABEL_H = 48;
const labelWidth = (text: string) => Math.round(text.length * 12.8 + 54);

const Callout: React.FC<{ ring: Ring; device: Plan["device"]; pose: Pose; t: number; t0: number; t1: number }> = ({ ring, device, pose, t, t0, t1 }) => {
  const a = interpolate(t, [t0, t0 + 0.28, t1 - 0.25, t1], [0, 1, 1, 0], { easing: ease, extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  if (a <= 0) return null;
  const pad = 5;
  const [bx, by, bw, bh] = ring.box;
  const tl = project(device, pose, bx - pad, by - pad);
  const w = (bw + 2 * pad) * tl.S;
  const h = (bh + 2 * pad) * tl.S;
  const grow = interpolate(t, [t0, t0 + 0.35], [0.965, 1], { easing: easeOut, extrapolateRight: "clamp" });
  const g = geo(device);
  // Label placement. The label must sit inside the browser window (desktop) or the stage margins (phone), clear of the caption.
  const region = device === "phone" ? { x0: 24, x1: 1896, y0: 24, y1: 880 } : { x0: WIN.x + 8, x1: WIN.x + WIN.w - 8, y0: g.y + 8, y1: g.y + g.h - 8 };
  const LW = ring.label ? labelWidth(ring.label) : 0;
  const cyMid = tl.y + h / 2 - LABEL_H / 2;
  const spots: Record<string, [number, number]> = {
    right: [tl.x + w + 14, cyMid],
    left: [tl.x - 14 - LW, cyMid],
    below: [Math.max(tl.x, region.x0), tl.y + h + 14],
    above: [Math.max(tl.x, region.x0), tl.y - LABEL_H - 12],
  };
  const pref = ring.side ?? "right";
  const order = pref === "right" ? ["right", "left", "below", "above"] : pref === "left" ? ["left", "right", "below", "above"] : pref === "above" ? ["above", "below", "right", "left"] : ["below", "above", "right", "left"];
  const fits = (k: string) => spots[k][0] >= region.x0 && spots[k][0] + LW <= region.x1 && spots[k][1] >= region.y0 && spots[k][1] + LABEL_H <= region.y1;
  let key = order.find(fits);
  let [lx, ly] = spots[key ?? pref];
  if (!key) {
    lx = Math.min(Math.max(lx, region.x0), region.x1 - LW);
    ly = Math.min(Math.max(ly, region.y0), region.y1 - LABEL_H);
  }
  const labelStyle: React.CSSProperties = { position: "absolute", left: lx, top: ly, fontFamily, fontWeight: 700, fontSize: 24, color: C.white, background: "rgba(8,27,50,.94)", border: "1px solid rgba(52,201,232,.55)", borderRadius: 14, padding: "0 16px", height: LABEL_H, boxSizing: "border-box", whiteSpace: "nowrap", boxShadow: "0 12px 30px rgba(0,0,0,.35)", opacity: a, display: "flex", alignItems: "center", gap: 10 };
  return (
    <>
      {/* the ring is clipped to the recorded screen, so it can never float outside the window */}
      <div style={{ position: "absolute", left: g.x, top: g.y, width: g.w, height: g.h, overflow: "hidden", borderRadius: device === "phone" ? 40 : "0 0 18px 18px", pointerEvents: "none" }}>
        <div
          style={{
            position: "absolute",
            left: tl.x - g.x,
            top: tl.y - g.y,
            width: w,
            height: h,
            opacity: a,
            transform: `scale(${grow})`,
            borderRadius: (ring.radius ?? 14) * tl.S + 4,
            border: `3px solid ${C.blue}`,
            boxShadow: `0 0 0 2px rgba(255,255,255,.85), 0 0 26px rgba(23,100,232,.55)${ring.dim ? ", 0 0 0 4000px rgba(8,27,50,.30)" : ""}`,
          }}
        />
      </div>
      {ring.label ? (
        <div style={labelStyle}>
          <span style={{ width: 8, height: 26, borderRadius: 4, background: C.cyan, display: "block" }} />
          {ring.label}
        </div>
      ) : null}
    </>
  );
};

/** Holds the last picture of the scene's footage (a still taken from the recording, see scripts/holds.mjs). */
const Hold: React.FC<{ id: string; seg: LaidSeg }> = ({ id, seg }) => {
  const n = NATIVE[seg.clip === "mobile" ? "phone" : "desktop"];
  return (
    <AbsoluteFill>
      <Img src={staticFile(`holds/${id}.png`)} style={{ width: n.w, height: n.h }} />
    </AbsoluteFill>
  );
};

const Segment: React.FC<{ seg: LaidSeg }> = ({ seg }) => {
  const f = useCurrentFrame();
  const op = seg.fadeFrames ? interpolate(f, [0, seg.fadeFrames], [0, 1], { easing: ease, extrapolateRight: "clamp" }) : 1;
  const rate = seg.rate ?? 1;
  const dev = seg.clip === "mobile" ? "phone" : "desktop";
  const n = NATIVE[dev];
  const src = seg.owner ? staticFile("owner-report-clip.mp4") : staticFile(`footage/${seg.clip}.mp4`);
  return (
    <AbsoluteFill style={{ opacity: op }}>
      <OffthreadVideo src={src} startFrom={Math.round(seg.from * FPS)} playbackRate={rate} muted style={{ width: n.w, height: n.h, objectFit: seg.owner ? "contain" : "fill", background: seg.owner ? "#000" : undefined }} />
    </AbsoluteFill>
  );
};

export const FootageScene: React.FC<{ plan: Plan; audioId: string; frames: number }> = ({ plan, audioId, frames }) => {
  const f = useCurrentFrame();
  const t = f / FPS;
  const lay = React.useMemo(() => layout(plan), [plan]);
  const g = geo(plan.device);
  const n = NATIVE[plan.device];

  const cams = React.useMemo(() => {
    const list = plan.cams.map((c: Cam) => ({
      t: sceneTime(lay.segs, c.clip ?? lay.segs[0].clip, c.at),
      cx: c.cx,
      cy: c.cy,
      s: c.s,
      dur: c.dur ?? 1.0,
      top: c.top ?? plan.top ?? 0,
    }));
    list.sort((a, b) => a.t - b.t);
    // The first keyframe is the starting pose; keep time 0 for it.
    list[0] = { ...list[0], t: 0 };
    return list;
  }, [plan, lay]);

  const rawPose = poseAt(cams, t);
  // Keep the app's fixed top bar out of view when zoomed in (it would show as a cropped sliver).
  const minCy = rawPose.top ? rawPose.top + g.h / (g.scale * rawPose.s) / 2 : 0;
  const pose = { ...rawPose, cy: Math.max(rawPose.cy, minCy) };
  const S = g.scale * pose.s;
  const tx = Math.min(0, Math.max(g.w - n.w * S, g.w / 2 - pose.cx * S));
  const ty = Math.min(0, Math.max(g.h - n.h * S, g.h / 2 - pose.cy * S));

  const rings = React.useMemo(() => plan.rings.map((r) => ({ r, t0: sceneTime(lay.segs, r.clip ?? lay.segs[0].clip, r.from), t1: sceneTime(lay.segs, r.clip ?? lay.segs[0].clip, r.to) })), [plan, lay]);
  const notes = React.useMemo(() => plan.notes.map((r) => ({ r, t0: sceneTime(lay.segs, r.clip ?? lay.segs[0].clip, r.from), t1: sceneTime(lay.segs, r.clip ?? lay.segs[0].clip, r.to) })), [plan, lay]);

  const active = [...lay.segs].reverse().find((s) => f >= s.start) ?? lay.segs[0];
    const isPhone = plan.device === "phone";

  const enter = interpolate(f, [0, 16], [0.985, 1], { easing: easeOut, extrapolateRight: "clamp" });

  return (
    <AbsoluteFill>
      <Sequence from={LEAD}>
        <Audio src={staticFile(`audio/${audioId}.mp3`)} />
      </Sequence>
      {/* device */}
      <div style={{ position: "absolute", left: 0, top: 0, width: 1920, height: 1080, transform: `scale(${enter})`, transformOrigin: "50% 40%" }}>
        {isPhone ? (
          <div style={{ position: "absolute", left: g.x - 14, top: g.y - 14, width: g.w + 28, height: g.h + 28, borderRadius: 54, background: "linear-gradient(145deg,#1B2A40,#0A1424)", boxShadow: "0 40px 90px rgba(0,0,0,.5), inset 0 0 0 2px rgba(255,255,255,.08)" }} />
        ) : (
          <div style={{ position: "absolute", left: WIN.x, top: WIN.y, width: WIN.w, height: WIN.chrome + WIN.h, borderRadius: 18, overflow: "hidden", boxShadow: "0 50px 100px rgba(0,0,0,.5), 0 0 0 1px rgba(255,255,255,.10)", background: "#fff" }}>
            <Chrome url={active.url ?? "/"} live="Real recording of the live app" />
          </div>
        )}
        <div style={{ position: "absolute", left: g.x, top: g.y, width: g.w, height: g.h, overflow: "hidden", borderRadius: isPhone ? 40 : "0 0 18px 18px", background: "#F5F7FB" }}>
          <div style={{ position: "absolute", left: 0, top: 0, width: n.w, height: n.h, transformOrigin: "0 0", transform: `translate(${tx}px, ${ty}px) scale(${S})` }}>
            {lay.segs.map((s, i) => (
              <Sequence key={i} from={s.start} durationInFrames={s.frames}>
                <Segment seg={s} />
              </Sequence>
            ))}
            {frames > lay.frames && (holds as Record<string, unknown>)[plan.id] ? (
              <Sequence from={lay.frames} durationInFrames={frames - lay.frames + 2}>
                <Hold id={plan.id} seg={lay.segs[lay.segs.length - 1]} />
              </Sequence>
            ) : null}
          </div>
          {notes.map(({ r, t0, t1 }, i) => {
            const a = interpolate(t, [t0, t0 + 0.3, t1 - 0.3, t1], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
            return a > 0 ? (
              <div key={i} style={{ position: "absolute", left: 18, bottom: 16, opacity: a }}>
                <Pill bg="rgba(8,27,50,.9)" style={{ fontSize: 20, fontWeight: 600, padding: "9px 16px" }}>
                  <span style={{ width: 9, height: 9, borderRadius: 5, background: C.cyan, display: "block" }} />
                  {r.text}
                </Pill>
              </div>
            ) : null;
          })}
        </div>
        {rings.map(({ r, t0, t1 }, i) => (
          <Callout key={i} ring={r} device={plan.device} pose={pose} t={t} t0={t0} t1={t1} />
        ))}
        {(plan.overlays ?? []).map((o, i) => {
          const t0 = sceneTime(lay.segs, lay.segs[0].clip, o.from);
          const t1 = sceneTime(lay.segs, lay.segs[0].clip, o.to) + o.hold;
          const a = interpolate(t, [t0, t0 + 0.5, t1 - 0.4, t1], [0, 1, 1, 0], { easing: ease, extrapolateLeft: "clamp", extrapolateRight: "clamp" });
          if (a <= 0) return null;
          const x = interpolate(t, [t0, t0 + 0.6], [120, 0], { easing: easeOut, extrapolateRight: "clamp" });
          return (
            <div key={i} style={{ position: "absolute", left: WIN.x + WIN.w - 470 - 30, top: WIN.y + WIN.chrome + 20, opacity: a, transform: `translateX(${x}px) rotate(${(1 - a) * 3}deg)` }}>
              <Img src={staticFile(o.src)} style={{ width: 470, height: 588, borderRadius: 22, boxShadow: "0 40px 90px rgba(0,0,0,.55), 0 0 0 4px rgba(255,255,255,.9)" }} />
              <div style={{ marginTop: 18, display: "flex", justifyContent: "center" }}>
                <Pill style={{ fontSize: 24 }}>
                  <span style={{ width: 9, height: 9, borderRadius: 5, background: C.cyan, display: "block" }} />
                  {o.caption}
                </Pill>
              </div>
            </div>
          );
        })}
        <SpeedPanel segs={lay.segs} frame={f} phone={isPhone} />
      </div>
    </AbsoluteFill>
  );
};
