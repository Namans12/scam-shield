// Generates web/public/examples/qr-receive.png: a QR that looks like "scan to receive money" but encodes a PAY request.
// Usage: npx tsx scripts/examples/make-qr.ts
import QRCode from "qrcode";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const out = resolve(root, "web/public/examples/qr-receive.png");
export const QR_PAYLOAD = "upi://pay?pa=bnbreward.cashback@ybl&pn=Cashback%20Reward&am=5000&tn=Reward%20credit&cu=INR";

mkdirSync(dirname(out), { recursive: true });
await QRCode.toFile(out, QR_PAYLOAD, { width: 600, margin: 4, errorCorrectionLevel: "M" });
console.log("wrote", out);
