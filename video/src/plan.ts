// The edit decision list. Every time below is a time inside a recorded clip (seconds) taken from the capture manifest
// (marks and element snapshots written by capture/record.mjs), so re-recording a clip moves the cuts, zooms and rings
// with it. Scene time is derived: narration timing decides how long a scene lasts, footage fills it.
import footage from "./generated/footage.json";
import timeline from "./generated/timeline.json";
import { FPS } from "./theme";

type Box = [number, number, number, number]; // x, y, w, h in recorded-screen pixels (1440x900, phone 390x844)
type Manifest = Record<string, { marks: Record<string, number>; regions?: Record<string, { t: number; x: number; y: number; w: number; h: number }[]>; snaps?: { label: string; t: number; boxes: Record<string, { x: number; y: number; w: number; h: number }[]> }[] }>;
const F = footage as unknown as Manifest;

export const mark = (clip: string, k: string, d = 0): number => {
  const v = F[clip]?.marks[k];
  if (v === undefined) throw new Error(`manifest: ${clip} has no mark ${k}`);
  return v + d;
};
/** The moment the page swapped from "Checking..." to the result (waitForResult sleeps 0.9 s before marking it). */
export const swap = (clip: string): number => mark(clip, "result") - 0.9;
export const snapT = (clip: string, label: string): number => {
  const s = F[clip]?.snaps?.find((x) => x.label === label);
  if (!s) throw new Error(`manifest: ${clip} has no snapshot ${label}`);
  return s.t;
};
export const snapBox = (clip: string, label: string, kind: string, i = 0, pad = 0): Box => {
  const b = F[clip]?.snaps?.find((x) => x.label === label)?.boxes[kind]?.[i];
  if (!b) throw new Error(`manifest: ${clip}/${label} has no ${kind}[${i}]`);
  return [b.x - pad, b.y - pad, b.w + 2 * pad, b.h + 2 * pad];
};

export const regionBox = (clip: string, label: string, pad = 0): Box => {
  const r = F[clip]?.regions?.[label]?.[0];
  if (!r) throw new Error(`manifest: ${clip} has no region ${label}`);
  return [r.x - pad, r.y - pad, r.w + 2 * pad, r.h + 2 * pad];
};

export interface Seg {
  clip: string;
  from: number;
  to: number;
  rate?: number;
  /** Cross-dissolve from the previous segment (a cut inside a clip, or between clips). */
  fade?: boolean;
  /** Text in the address bar while this segment plays. */
  url?: string;
  /** Part of a fast-forward ramp (see `ramp`): the speed panel with the real-time clock is shown while these play. */
  ff?: boolean;
  /** The segment is the owner-recorded clip. */
  owner?: boolean;
}
export interface Cam {
  /** Clip time at which the camera has arrived. */
  at: number;
  clip?: string;
  cx: number;
  cy: number;
  s: number;
  /** Seconds the move takes (it ends at `at`). */
  dur?: number;
  /** Overrides the plan's `top` for this keyframe (e.g. 0 to show the app bar). */
  top?: number;
}
export interface Ring {
  clip?: string;
  from: number;
  to: number;
  box: Box;
  label?: string;
  /** Where the label sits relative to the ring. */
  side?: "right" | "left" | "above" | "below";
  dim?: boolean;
  radius?: number;
}
export interface Note {
  clip?: string;
  from: number;
  to: number;
  text: string;
}
export interface Plan {
  id: string;
  device: "desktop" | "phone";
  segs: Seg[];
  cams: Cam[];
  rings: Ring[];
  notes: Note[];
  /** An image shown on top of the footage (the real warning card the app rendered). Appears at `from`, stays `hold` s after `to`. */
  overlays?: { src: string; from: number; to: number; hold: number; caption: string }[];
  /** Extra seconds appended after the last segment (frozen). */
  tail?: number;
  /** Top of the visible area when zoomed (px of the recording), to keep the app's fixed header out of frame. */
  top?: number;
}

const TLX = timeline as unknown as { ownerClip: { duration: number } | null };
export const ownerClip = TLX.ownerClip;
const R = "/result/…";

/** Fast-forwards the wait for the result: eases 2x, 3x, 4x, then back down 3x, 2x, so the speed change is visible. The middle is exactly 4x. */
export function ramp(clip: string, a: number, b: number, url: string, fadeFirst = false): Seg[] {
  const r = 0.6;
  return [
    { clip, from: a, to: a + r, rate: 2, ff: true, fade: fadeFirst, url },
    { clip, from: a + r, to: a + 2 * r, rate: 3, ff: true, url },
    { clip, from: a + 2 * r, to: b - 2 * r, rate: 4, ff: true, url },
    { clip, from: b - 2 * r, to: b - r, rate: 3, ff: true, url },
    { clip, from: b - r, to: b, rate: 2, ff: true, url },
  ];
}
const FADE = 8;

// ---------------------------------------------------------------- scenes
export const plans: Record<string, Plan> = {};
const APP_TOP = 68; // the app bar is 64 px tall

plans.landing = {
  id: "landing",
  device: "desktop",
  segs: [
    { clip: "landing", from: 2.0, to: 5.0, url: "/" },
    { clip: "landing", from: 9.0, to: 14.4, fade: true, url: "/" },
  ],
  cams: [
    { at: 2.0, cx: 720, cy: 450, s: 1.0 },
    { at: 5.0, cx: 720, cy: 450, s: 1.06, dur: 3.0 },
    { at: 11.0, cx: 720, cy: 420, s: 1.0, dur: 1.0 },
  ],
  rings: [],
  notes: [],
};

{
  const c = "kyc";
  const sw = swap(c);
  const click = mark(c, "click");
  plans.kyc = {
    id: c,
    device: "desktop",
    segs: [
      { clip: c, from: 0.9, to: click - 0.2, url: "/check" },
      ...ramp(c, click - 0.2, sw, "/check"),
      { clip: c, from: sw, to: mark(c, "verdict") + 2.0, url: R },
      { clip: c, from: mark(c, "verdict") + 2.0, to: mark(c, "redflags") + 2.9, fade: true, url: R },
      { clip: c, from: mark(c, "hits") - 1.8, to: mark(c, "hits") + 2.8, fade: true, url: R },
      { clip: c, from: mark(c, "hits") + 2.8, to: mark(c, "linkscan") + 2.9, url: R },
    ],
    cams: [
      { at: 0.3, cx: 720, cy: 450, s: 1.0 },
      { at: mark(c, "examples-visible") + 0.2, cx: 840, cy: 690, s: 1.45, dur: 1.4 },
      { at: click + 0.6, cx: 840, cy: 420, s: 1.45, dur: 1.0 },
      { at: sw, cx: 840, cy: 370, s: 1.2, dur: 1.0 },
      { at: mark(c, "redflags"), cx: 840, cy: 480, s: 1.4, dur: 1.3 },
      { at: mark(c, "hits") - 0.4, cx: 840, cy: 340, s: 1.5, dur: 1.0 },
      { at: mark(c, "linkscan"), cx: 840, cy: 480, s: 1.3, dur: 1.0 },
    ],
    rings: [
      { from: sw + 0.5, to: sw + 2.4, box: [480, 89, 720, 182], label: "Verdict: Scam", dim: true },
      { from: sw + 2.5, to: mark(c, "verdict") + 1.9, box: [480, 276, 720, 150], label: "Risk score and type of scam", dim: true },
      { from: snapT(c, "redflags") + 0.1, to: snapT(c, "redflags") + 1.0, box: snapBox(c, "redflags", "quote", 0, 4), label: "The exact words from the message", dim: true },
      { from: snapT(c, "redflags") + 1.0, to: snapT(c, "redflags") + 1.9, box: snapBox(c, "redflags", "quote", 1, 4), dim: true },
      { from: snapT(c, "redflags") + 1.9, to: snapT(c, "redflags") + 2.8, box: snapBox(c, "redflags", "quote", 2, 4), dim: true },
      { from: snapT(c, "hits") + 0.1, to: snapT(c, "hits") + 1.5, box: snapBox(c, "hits", "badge", 0, 6), label: "Reported 3 times", dim: true },
      { from: snapT(c, "hits") + 1.5, to: snapT(c, "hits") + 2.8, box: snapBox(c, "hits", "badge", 1, 6), label: "Reported 3 times", dim: true },
      { from: snapT(c, "linkscan") + 0.1, to: snapT(c, "linkscan") + 1.8, box: snapBox(c, "linkscan", "img", 0, 4), label: "The page, seen in an isolated browser", dim: true },
    ],
    notes: [{ from: snapT(c, "hits"), to: snapT(c, "hits") + 2.8, text: "Demo data: the shared list is pre-filled while the app is new" }],
    tail: 0,
    top: APP_TOP,
  };
}

{
  const c = "qr";
  const sw = swap(c);
  const click = mark(c, "click");
  const qrT = snapT(c, "qr");
  plans.qr = {
    id: c,
    device: "desktop",
    segs: [
      { clip: c, from: 3.0, to: click - 0.2, url: "/check" },
      ...ramp(c, click - 0.2, sw, "/check"),
      { clip: c, from: sw, to: sw + 1.0, url: R },
      { clip: c, from: mark(c, "verdict") + 2.2, to: mark(c, "qr") + 4.0, fade: true, url: R },
    ],
    cams: [
      { at: 3.0, cx: 720, cy: 450, s: 1.0 },
      { at: mark(c, "examples-visible") + 0.2, cx: 840, cy: 690, s: 1.4, dur: 1.4 },
      { at: sw, cx: 840, cy: 360, s: 1.2, dur: 1.0 },
      { at: mark(c, "qr"), cx: 840, cy: 370, s: 1.55, dur: 1.2 },
    ],
    rings: [
      { from: qrT + 0.4, to: qrT + 4.0, box: [480, 250, 720, 290], label: "Asks you to PAY, not receive", dim: true },
    ],
    notes: [],
    tail: 0,
    top: APP_TOP,
  };
}

{
  const c = "voice";
  const sw = swap(c);
  const click = mark(c, "click");
  plans.voice = {
    id: c,
    device: "desktop",
    segs: [
      { clip: c, from: 3.0, to: click - 0.2, url: "/check" },
      ...ramp(c, click - 0.2, sw, "/check"),
      { clip: c, from: sw, to: mark(c, "verdict") + 1.4, url: R },
      { clip: c, from: mark(c, "transcript-open") - 2.0, to: mark(c, "transcript-open") + 2.6, fade: true, url: R },
    ],
    cams: [
      { at: 3.0, cx: 720, cy: 450, s: 1.0 },
      { at: mark(c, "examples-visible") + 0.2, cx: 840, cy: 690, s: 1.4, dur: 1.4 },
      { at: sw, cx: 840, cy: 360, s: 1.2, dur: 1.0 },
      { at: mark(c, "transcript-open") + 0.2, cx: 840, cy: 360, s: 1.4, dur: 1.2 },
    ],
    rings: [
      { from: sw + 0.5, to: mark(c, "verdict") + 1.3, box: [480, 89, 720, 182], label: "Verdict: Scam", dim: true },
      { from: snapT(c, "transcript") + 0.1, to: mark(c, "transcript-open") + 2.5, box: snapBox(c, "transcript", "details", 0, 4), label: "Transcript of the voice note", dim: true },
    ],
    notes: [],
    tail: 0,
    top: APP_TOP,
  };
}

{
  const c = "payment";
  const sw = swap(c);
  const click = mark(c, "click");
  const rf = snapT(c, "redflags");
  plans.payment = {
    id: c,
    device: "desktop",
    segs: [
      { clip: c, from: 3.0, to: click - 0.2, url: "/check" },
      ...ramp(c, click - 0.2, sw, "/check"),
      { clip: c, from: sw, to: sw + 1.0, url: R },
      { clip: c, from: rf - 0.5, to: rf + 8.1, fade: true, url: R },
    ],
    cams: [
      { at: 3.0, cx: 720, cy: 450, s: 1.0 },
      { at: mark(c, "examples-visible") + 0.2, cx: 840, cy: 690, s: 1.4, dur: 1.4 },
      { at: sw, cx: 840, cy: 360, s: 1.2, dur: 1.0 },
      { at: rf, cx: 840, cy: 520, s: 1.35, dur: 0.8 },
    ],
    rings: [
      { from: rf + 0.6, to: rf + 4.2, box: snapBox(c, "redflags", "quote", 0, 4), label: "31 September does not exist", dim: true },
      { from: rf + 6.2, to: rf + 8.0, box: snapBox(c, "redflags", "quote", 2, 4), label: "Name and UPI ID do not match", dim: true },
      { from: rf + 4.4, to: rf + 6.2, box: snapBox(c, "redflags", "quote", 1, 4), label: "A UTR has 12 digits, this has 10", dim: true },
    ],
    notes: [],
    tail: 0,
    top: APP_TOP,
  };
}

{
  const c = "actions";
  const bar = mark(c, "bar");
  const ro = mark(c, "report-open");
  const cm = mark(c, "complaint");
  const sc = mark(c, "share-click");
  plans.actions = {
    id: c,
    device: "desktop",
    segs: [
      { clip: c, from: bar - 1.8, to: ro + 3.4, url: R },
      { clip: c, from: cm - 0.3, to: mark(c, "amount-typed") + 0.6, fade: true, url: "/complaint/…" },
      { clip: c, from: mark(c, "draft") - 0.6, to: mark(c, "copied") + 1.9, fade: true, url: "/complaint/…" },
      { clip: c, from: sc - 1.0, to: mark(c, "share-done") + 0.4, fade: true, url: R },
    ],
    cams: [
      { at: bar - 1.8, cx: 840, cy: 560, s: 1.0 },
      { at: bar, cx: 840, cy: 560, s: 1.5, dur: 1.2 },
      { at: ro + 0.7, cx: 720, cy: 450, s: 1.5, dur: 0.9 },
      { at: cm + 0.4, cx: 840, cy: 420, s: 1.4, dur: 1.0 },
      { at: mark(c, "draft"), cx: 840, cy: 500, s: 1.4, dur: 1.0 },
      { at: sc - 0.4, cx: 840, cy: 600, s: 1.5, dur: 0.8 },
    ],
    rings: [
      { from: bar + 0.2, to: ro - 0.3, box: snapBox(c, "bar", "group", 0, 2), label: "Report · Complaint · Share", dim: true },
      { from: snapT(c, "dialog") + 0.2, to: ro + 3.3, box: snapBox(c, "dialog", "dialogNote", 0, 3), label: "Sign in with Google first", dim: true },
      { from: snapT(c, "amount-typed") - 1.0, to: snapT(c, "amount-typed") + 0.4, box: snapBox(c, "amount-typed", "input", 0, 4), label: "The amount lost", dim: true },
      { from: snapT(c, "copied") - 0.8, to: snapT(c, "copied") + 0.7, box: snapBox(c, "copied", "textarea", 0, 4), label: "A ready-to-paste complaint", dim: true },
      { from: snapT(c, "copied") + 0.8, to: snapT(c, "copied") + 2.2, box: regionBox(c, "copy", 4), label: "Copied", dim: true, side: "right" },
    ],
    notes: [],
    overlays: [{ src: "share-card.png", from: mark(c, "share-done") - 1.0, to: mark(c, "share-done") + 0.4, hold: 2.4, caption: "The warning card the app generated" }],
    tail: 0,
    top: APP_TOP,
  };
}

plans.phone = {
  id: "phone",
  device: "phone",
  segs: [
    { clip: "mobile", from: 2.2, to: 3.9, url: "/check" },
    ...ramp("mobile", 3.9, 15.2, "/check"),
    { clip: "mobile", from: 15.2, to: 17.8, url: R },
  ],
  cams: [{ at: 2.2, cx: 195, cy: 422, s: 1.0 }],
  rings: [{ from: 15.9, to: 18.3, box: [6, 749, 378, 91], label: "Report · Complaint · Share", dim: false, side: "right" }],
  notes: [],
  tail: 0,
};

{
  const c = "hindi";
  const sw = swap(c);
  const click = mark(c, "click");
  plans.hindi = {
    id: c,
    device: "desktop",
    segs: [
      { clip: c, from: mark(c, "hindi-on") - 1.8, to: mark(c, "hindi-on") + 1.4, url: "/check" },
      ...ramp(c, click - 1.0, sw, "/check", true),
      { clip: c, from: sw, to: sw + 3.4, url: R },
      { clip: c, from: mark(c, "trends") - 0.3, to: mark(c, "trends") + 5.2, fade: true, url: "/trends" },
    ],
    cams: [
      { at: mark(c, "hindi-on") - 1.8, cx: 960, cy: 300, s: 1.0 },
      { at: mark(c, "hindi-on") + 0.5, cx: 800, cy: 330, s: 1.15, dur: 1.2, top: 0 },
      { at: click, cx: 840, cy: 690, s: 1.35, dur: 0.6 },
      { at: sw, cx: 840, cy: 370, s: 1.2, dur: 1.0 },
      { at: mark(c, "trends") + 0.3, cx: 840, cy: 400, s: 1.3, dur: 1.0 },
    ],
    rings: [
      { from: mark(c, "hindi-on") + 0.5, to: mark(c, "hindi-on") + 1.35, box: [1244, 8, 172, 48], label: "हिंदी on", dim: true, side: "below" },
      { from: sw + 0.4, to: sw + 2.4, box: [480, 89, 720, 206], label: "Verdict: Scam", dim: true },
    ],
    notes: [
      { from: mark(c, "hindi-on") + 0.4, to: sw + 3.4, text: "Hindi interface, English captions" },
      { from: mark(c, "trends"), to: mark(c, "trends") + 5.2, text: "Trends include demo data while the app is new" },
    ],
    tail: 0,
    top: APP_TOP,
  };
}

// Optional owner-recorded Report clip (assets/owner-report-clip.mp4): replaces the dialog footage when it exists.
if (ownerClip) {
  const a = plans.actions;
  const ro = mark("actions", "report-open");
  const dur = Math.min(ownerClip.duration, 8);
  const first = a.segs[0];
  a.segs = [
    { ...first, to: ro - 0.25 },
    { clip: "owner-report-clip", from: 0, to: dur, fade: true, owner: true, url: R },
    ...a.segs.slice(1),
  ];
  a.rings = a.rings.filter((r) => r.label !== "Sign in with Google first");
  a.cams = [...a.cams.filter((c) => c.at < ro - 0.25), { clip: "owner-report-clip", at: 0.3, cx: 720, cy: 450, s: 1.0, dur: 0.6 }, ...a.cams.filter((c) => c.at > ro + 4.2 || false)];
}

// ---------------------------------------------------------------- layout
export interface LaidSeg extends Seg {
  start: number; // frames from scene start
  frames: number;
  fadeFrames: number;
}
export function layout(plan: Plan): { segs: LaidSeg[]; frames: number } {
  const out: LaidSeg[] = [];
  let end = 0;
  for (const s of plan.segs) {
    const frames = Math.max(1, Math.round(((s.to - s.from) / (s.rate ?? 1)) * FPS));
    const fadeFrames = s.fade && out.length ? FADE : 0;
    const start = out.length ? end - fadeFrames : 0;
    out.push({ ...s, start, frames, fadeFrames });
    end = start + frames;
  }
  return { segs: out, frames: end + Math.round((plan.tail ?? 0) * FPS) };
}

/** Scene time in seconds of a clip time (first segment of that clip that contains it, else nearest). */
export function sceneTime(segs: LaidSeg[], clip: string, t: number): number {
  let best: LaidSeg | undefined;
  let bestD = Infinity;
  for (const s of segs) {
    if (s.clip !== clip) continue;
    const d = t < s.from ? s.from - t : t > s.to ? t - s.to : 0;
    if (d < bestD) {
      bestD = d;
      best = s;
    }
  }
  if (!best) return 0;
  const tc = Math.min(Math.max(t, best.from), best.to);
  return (best.start + ((tc - best.from) / (best.rate ?? 1)) * FPS) / FPS;
}

export const SCENE_ORDER = ["intro", "landing", "kyc", "qr", "voice", "payment", "actions", "phone", "hindi", "architecture", "benchmark", "closing"] as const;
export const LEAD = Math.round(0.5 * FPS);
export const TAIL = Math.round(0.45 * FPS);
export const OVERLAP = 10; // frames: scenes cross-fade over this many frames

const TL = timeline as unknown as { engine: string; ownerClip: { duration: number } | null; scenes: Record<string, { duration: number; sentences: { start: number; end: number; caption: string }[] }> };
export const engine = TL.engine;

export function sceneFrames(id: string): number {
  const audio = Math.ceil(TL.scenes[id].duration * FPS);
  const base = LEAD + audio + TAIL;
  const p = plans[id];
  return p ? Math.max(base, layout(p).frames + 6) : base;
}

export function sceneStarts(): { id: string; start: number; frames: number; audioEnd: number; visual: number }[] {
  const out: { id: string; start: number; frames: number; audioEnd: number; visual: number }[] = [];
  let cursor = 0;
  for (const id of SCENE_ORDER) {
    const frames = sceneFrames(id);
    out.push({ id, start: cursor, frames, audioEnd: LEAD + Math.ceil(TL.scenes[id].duration * FPS), visual: plans[id] ? layout(plans[id]).frames : 0 });
    cursor += frames - OVERLAP;
  }
  return out;
}
export const totalFrames = (): number => {
  const s = sceneStarts();
  const last = s[s.length - 1];
  return last.start + last.frames;
};
export const narration = TL.scenes;
