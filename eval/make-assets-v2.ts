// Generates the QR for adversarial case a12: a UPI "pay" QR that the accompanying text frames as a way to receive cashback.
// The UPI ID is fictional and not in the seeded scam list. Usage: npx tsx eval/make-assets-v2.ts
import QRCode from "qrcode";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const dir = resolve(dirname(fileURLToPath(import.meta.url)), "assets");
mkdirSync(dir, { recursive: true });
await QRCode.toFile(resolve(dir, "scam-qr-v2.png"), "upi://pay?pa=rewardclaim.team@okicici&pn=Reward%20Claim&am=4999&cu=INR&tn=Cashback", { width: 600, margin: 4 });
console.log("wrote", resolve(dir, "scam-qr-v2.png"));
