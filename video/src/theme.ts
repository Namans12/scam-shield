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

/** The browser window: 1344x840 content (the 1440x900 recordings scaled by 0.9333), 44px chrome. */
export const WIN = { x: 288, y: 26, w: 1344, h: 840, chrome: 44 };
export const BASE = WIN.w / 1440;
