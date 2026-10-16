// Generates web/public/examples/digital-arrest.mp3 with Cloud Text-to-Speech (hi-IN). All names and numbers are fictional.
// Needs: gcloud logged in, texttospeech.googleapis.com enabled. Usage: npx tsx scripts/examples/make-voice.ts
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const PROJECT = process.env.PROJECT ?? "project-91260b43-6705-4176-b71";
const out = resolve(dirname(fileURLToPath(import.meta.url)), "../../web/public/examples/digital-arrest.mp3");

const SCRIPT =
  "Hello, main CBI headquarters Delhi se Inspector Rajesh Sharma bol raha hoon. Aapke Aadhaar card se ek parcel book hua hai, " +
  "jisme MDMA drugs aur paanch passport mile hain. Yeh ek bahut serious criminal case hai. " +
  "Aap abhi video call par rahiye, kisi ko phone mat kijiye, aur kisi ko is baare mein mat bataiye, warna aapko arrest kar liya jayega. " +
  "Case khatam karne ke liye aapko verification fee ke roop mein pachaas hazaar rupaye turant bhejne honge. " +
  "UPI ID hai: c b i dot verify dot desk at y b l. Payment ke baad aapka account clear ho jayega. " +
  "Agar koi sawaal ho toh is number par call kijiye: saat, zero, zero, zero, zero, do, do, do, do. Jaldi kijiye, time bahut kam hai.";

const token = execFileSync("gcloud", ["auth", "print-access-token"], { encoding: "utf8" }).trim();
const res = await fetch("https://texttospeech.googleapis.com/v1/text:synthesize", {
  method: "POST",
  headers: { authorization: `Bearer ${token}`, "x-goog-user-project": PROJECT, "content-type": "application/json" },
  body: JSON.stringify({
    input: { text: SCRIPT },
    voice: { languageCode: "hi-IN", name: "hi-IN-Wavenet-B" },
    audioConfig: { audioEncoding: "MP3", speakingRate: 1.05 },
  }),
});
if (!res.ok) throw new Error(`TTS ${res.status}: ${(await res.text()).slice(0, 300)}`);
const { audioContent } = (await res.json()) as { audioContent: string };
writeFileSync(out, Buffer.from(audioContent, "base64"));
console.log("wrote", out);
