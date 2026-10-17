import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.dirname(fileURLToPath(import.meta.url));
const wordmark = JSON.parse(await readFile(path.join(root, 'wordmark-path.json'), 'utf8'));
export const palettes = [
  { id: 'a', name: 'Blue / Cyan', ink: '#102B50', mid: '#1764E8', light: '#34C9E8', face: '#A8ECF8', dark: '#081B32', onDark: '#79DDF2', small: '#2374DC' },
  { id: 'b', name: 'Teal / Emerald', ink: '#103E40', mid: '#0F766E', light: '#23B99D', face: '#A1EDDA', dark: '#081B32', onDark: '#72DCC6', small: '#148C80' },
  { id: 'c', name: 'Indigo / Violet', ink: '#272C59', mid: '#5555CE', light: '#9A7CEF', face: '#DDD3FF', dark: '#081B32', onDark: '#C2B2FF', small: '#7770DE' },
];

// Original geometry. 256-unit canvas; shield on x=128; rounded 10-unit frame.
const shield = 'M75 52 L36 68 V108 C36 162 70 203 128 232 C144 224 158 215 170 204 M210 153 C216 139 220 124 220 108 V68 L158 42';
// The upper, open end and lower taper describe a continuous folded S ribbon.
const ribbon = 'M137 24 C100 36 64 57 64 87 C64 116 91 130 126 141 C160 152 183 166 183 185 C183 199 173 211 157 218 C184 214 202 194 202 170 C202 137 175 121 141 110 C109 100 88 91 88 76 C88 61 108 51 137 42 Z';
const face = 'M137 24 C100 36 64 57 64 87 C64 116 91 130 126 141 C160 152 183 166 183 185 C183 198 173 211 157 218 C178 203 189 188 188 172 C187 145 162 132 131 122 C96 111 76 97 76 79 C76 57 104 40 137 24 Z';
const smallShield = 'M104 36 L32 66 V108 C32 162 68 204 128 234 C188 204 224 162 224 108 V66 L164 42';
const smallRibbon = 'M140 22 C88 39 57 61 57 91 C57 122 85 136 123 148 C153 157 176 168 180 187 C185 174 184 157 176 145 C166 128 147 120 128 113 C99 103 85 94 85 80 C85 65 105 54 140 43 Z';

function defs(p, { small = false, mono = false, dark = false } = {}) {
  const cx = small ? 124 : 126, cy = small ? 177 : 176;
  const r = small ? 32 : 30;
  const gap = small ? 14 : 12;
  return `<defs>
    ${(!small && !mono) ? `<linearGradient id="ribbon" x1="85" y1="44" x2="183" y2="200" gradientUnits="userSpaceOnUse"><stop stop-color="${p.light}"/><stop offset=".49" stop-color="${p.mid}"/><stop offset="1" stop-color="${dark ? p.mid : p.ink}"/></linearGradient><linearGradient id="face" x1="82" y1="57" x2="181" y2="186" gradientUnits="userSpaceOnUse"><stop stop-color="${p.face}"/><stop offset=".55" stop-color="${p.light}"/><stop offset="1" stop-color="${p.mid}"/></linearGradient>` : ''}
    <mask id="lens-clearance" maskUnits="userSpaceOnUse" x="0" y="0" width="256" height="256"><rect width="256" height="256" fill="white"/><circle cx="${cx}" cy="${cy}" r="${r + gap}" fill="black"/><path d="M${cx+23} ${cy+23} L${small?180:176} 226" fill="none" stroke="black" stroke-width="${small?32:26}" stroke-linecap="round"/></mask>
  </defs>`;
}

export function markBody(p, opts = {}) {
  const { small = false, mono = false, dark = false } = opts;
  const ink = mono ? 'currentColor' : small ? p.small : dark ? p.onDark : p.ink;
  const cx = small ? 124 : 126, cy = small ? 177 : 176;
  return `${defs(p, opts)}
  <g mask="url(#lens-clearance)">
    <path d="${small ? smallShield : shield}" fill="none" stroke="${ink}" stroke-width="${small ? 19 : 10}" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="${small ? smallRibbon : ribbon}" fill="${mono ? 'currentColor' : small ? p.small : 'url(#ribbon)'}"/>
    ${(!small && !mono) ? `<path d="${face}" fill="url(#face)"/>` : ''}
  </g>
  <g fill="none" stroke="${ink}" stroke-width="${small ? 17 : 14}" stroke-linecap="round">
    <path d="M${cx+23} ${cy+23} L${small ? 180 : 176} 226"/>
    <circle cx="${cx}" cy="${cy}" r="${small ? 32 : 30}"/>
  </g>`;
}

const svg = (body, viewBox, extra = '') => `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" ${extra}>\n${body}\n</svg>\n`;
function lettering(fill) {
  return `<g fill="${fill}" transform="translate(218 76) scale(1.03)">${wordmark.paths.map(d => `<path d="${d}"/>`).join('')}</g>`;
}
for (const p of palettes) {
  const dir = path.join(root, `option-${p.id}`);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, 'mark.svg'), svg(markBody(p), '0 0 256 256', 'role="img" aria-label="Scam Shield"'));
  await writeFile(path.join(dir, 'mark-small.svg'), svg(markBody(p, {small:true}), '0 0 256 256', 'role="img" aria-label="Scam Shield"'));
  await writeFile(path.join(dir, 'mark-mono.svg'), svg(markBody(p, {mono:true}), '0 0 256 256', `color="${p.ink}" role="img" aria-label="Scam Shield"`));
  const regular = `<g transform="translate(12 8) scale(.72)">${markBody(p)}</g>${lettering(p.ink)}`;
  const onDark = `<rect width="720" height="200" rx="28" fill="${p.dark}"/><g transform="translate(12 8) scale(.72)">${markBody(p,{dark:true})}</g>${lettering('#F6FAFF')}`;
  await writeFile(path.join(dir, 'lockup-horizontal.svg'), svg(regular, '0 0 720 200', 'role="img" aria-label="Scam Shield"'));
  await writeFile(path.join(dir, 'lockup-on-dark.svg'), svg(onDark, '0 0 720 200', 'role="img" aria-label="Scam Shield"'));
}
console.log(`Built 15 SVGs; ${wordmark.font}, outlined into ${wordmark.paths.length} paths. Wordmark width: ${(wordmark.width*1.03).toFixed(1)}.`);
