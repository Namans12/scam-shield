import { Config } from "@remotion/cli/config";
import { existsSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

Config.setVideoImageFormat("jpeg");
Config.setJpegQuality(95);
Config.setOverwriteOutput(true);
Config.setCodec("h264");
Config.setPixelFormat("yuv420p");
Config.setCrf(16);

// Reuse the Chromium that Playwright already downloaded instead of letting Remotion fetch its own browser.
const cache = join(homedir(), "Library/Caches/ms-playwright");
if (existsSync(cache)) {
  for (const dir of readdirSync(cache).filter((d) => d.startsWith("chromium_headless_shell"))) {
    const exe = join(cache, dir, "chrome-mac/headless_shell");
    const exeArm = join(cache, dir, "chrome-headless-shell-mac-arm64/chrome-headless-shell");
    const found = [exeArm, exe].find((p) => existsSync(p));
    if (found) {
      Config.setBrowserExecutable(found);
      break;
    }
  }
}
