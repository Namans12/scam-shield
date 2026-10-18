import { loadFont } from "@remotion/google-fonts/Inter";

export const { fontFamily } = loadFont("normal", { weights: ["400", "500", "600", "700", "800"], subsets: ["latin"] });

export const C = {
  navy: "#081B32",
  navy2: "#102B50",
  navy3: "#16376A",
  blue: "#1764E8",
  cyan: "#34C9E8",
  white: "#FFFFFF",
  ink: "#0B1B32",
  muted: "#9FB3CC",
  soft: "#C9D8EC",
  amber: "#F5B83D",
  red: "#E5484D",
  green: "#3DD6A0",
};

export const W = 1920;
export const H = 1080;
export const FPS = 30;

/** The browser window: 1296x810 content (the 1440x900 recordings scaled by 0.9), 44px chrome. Leaves room for a two-line caption and the footnote. */
export const WIN = { x: 312, y: 16, w: 1296, h: 810, chrome: 44 };
/** Bottom padding of the caption box (a two-line caption then starts at y 900, 40 px below the window). */
export const CAPTION_BOTTOM = 54;
export const BASE = WIN.w / 1440;
