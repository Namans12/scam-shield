import React from "react";
import { AbsoluteFill, Audio, Img, OffthreadVideo, Sequence, staticFile, useCurrentFrame, interpolate } from "remotion";
import { BASE, C, FPS, WIN, fontFamily } from "../theme";
import { ease, easeOut, Pill } from "../components/common";
import holds from "../generated/holds.json";
import { layout, sceneTime, type Cam, type LaidSeg, type Plan, type Ring, LEAD } from "../plan";

const NATIVE = { desktop: { w: 1440, h: 900 }, phone: { w: 390, h: 844 } } as const;

/** Where the recorded screen sits on the 1920x1080 stage. */
function geo(device: Plan["device"]) {
  if (device === "phone") return { x: 765, y: 56, w: 390, h: 844, scale: 1 };
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

const SpeedBadge: React.FC<{ rate: number; frame: number; phone?: boolean }> = ({ rate, frame, phone }) => {
  const pulse = 0.5 + 0.5 * Math.sin(frame / 5);
  return (
    <div style={phone ? { position: "absolute", left: 1210, top: 140 } : { position: "absolute", right: WIN.x + 22, top: WIN.y + WIN.chrome + 20 }}>
      <Pill bg={C.amber} color={C.navy} style={{ fontSize: 26, fontWeight: 800, padding: "12px 22px", boxShadow: `0 10px 30px rgba(245,184,61,${0.28 + pulse * 0.2})` }}>
        <svg width="26" height="20" viewBox="0 0 26 20" fill={C.navy}>
          <path d="M1 2l10 8-10 8z" />
          <path d="M13 2l10 8-10 8z" />
        </svg>
        Sped up {rate}x
      </Pill>
    </div>
  );
};

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
  // label placement (stage pixels)
  const side = ring.side ?? "right";
  const labelStyle: React.CSSProperties = { position: "absolute", fontFamily, fontWeight: 700, fontSize: 24, color: C.white, background: "rgba(8,27,50,.94)", border: "1px solid rgba(52,201,232,.55)", borderRadius: 14, padding: "10px 16px 11px", whiteSpace: "nowrap", boxShadow: "0 12px 30px rgba(0,0,0,.35)", opacity: a, display: "flex", alignItems: "center", gap: 10 };
  let lx = tl.x + w + 20;
  let ly = tl.y + h / 2 - 24;
  if (side === "left") {
    lx = tl.x - 20;
    ly = tl.y + h / 2 - 24;
    labelStyle.transform = "translateX(-100%)";
  } else if (side === "above") {
    lx = tl.x;
    ly = tl.y - 60;
  } else if (side === "below") {
    lx = tl.x;
    ly = tl.y + h + 14;
  }
  // keep the label on the stage: when it would run off the right edge, flip it to the left of the ring
  if (side === "right" && lx + 520 > 1920) {
    lx = tl.x - 20;
    labelStyle.transform = "translateX(-100%)";
  }
  void g;
  return (
    <>
      <div
        style={{
          position: "absolute",
          left: tl.x,
          top: tl.y,
          width: w,
          height: h,
          opacity: a,
          transform: `scale(${grow})`,
          borderRadius: (ring.radius ?? 14) * tl.S + 4,
          border: `3px solid ${C.blue}`,
          boxShadow: `0 0 0 2px rgba(255,255,255,.85), 0 0 26px rgba(23,100,232,.55)${ring.dim ? ", 0 0 0 4000px rgba(8,27,50,.30)" : ""}`,
          clipPath: undefined,
        }}
      />
      {ring.label ? (
        <div style={{ ...labelStyle, left: lx, top: ly }}>
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
  const sped = lay.segs.find((s) => (s.rate ?? 1) > 1 && f >= s.start && f < s.start + s.frames);
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
            <div key={i} style={{ position: "absolute", left: 1070, top: 64, opacity: a, transform: `translateX(${x}px) rotate(${(1 - a) * 3}deg)` }}>
              <Img src={staticFile(o.src)} style={{ width: 528, height: 660, borderRadius: 22, boxShadow: "0 40px 90px rgba(0,0,0,.55), 0 0 0 4px rgba(255,255,255,.9)" }} />
              <div style={{ marginTop: 18, display: "flex", justifyContent: "center" }}>
                <Pill style={{ fontSize: 24 }}>
                  <span style={{ width: 9, height: 9, borderRadius: 5, background: C.cyan, display: "block" }} />
                  {o.caption}
                </Pill>
              </div>
            </div>
          );
        })}
        {sped ? <SpeedBadge rate={sped.rate ?? 1} frame={f} phone={isPhone} /> : null}
      </div>
    </AbsoluteFill>
  );
};
