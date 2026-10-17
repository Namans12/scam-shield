import { useId } from "react";
import { cn } from "@/lib/utils";

/**
 * Scam Shield mark: a shield framing an S ribbon with a magnifying lens ("look closely"), deliberately not a tick:
 * nothing in this app is ever called safe. Source of truth: docs/brand/logo-final. The shield outline and lens ring
 * follow --logo-outline so the mark stays legible in light and dark. Below 40 px the simplified flat mark is used.
 */
export function ShieldMark({ size = 28, className }: { size?: number; className?: string }) {
  const uid = useId().replace(/:/g, "");
  if (size < 40) {
    return (
      <svg viewBox="0 0 256 256" width={size} height={size} role="img" aria-label="Scam Shield" className={cn("shrink-0", className)}>
        <defs>
          <mask id={`${uid}-m`} maskUnits="userSpaceOnUse" x="0" y="0" width="256" height="256">
            <rect width="256" height="256" fill="white" />
            <circle cx="124" cy="177" r="46" fill="black" />
            <path d="M147 200 L180 226" fill="none" stroke="black" strokeWidth="32" strokeLinecap="round" />
          </mask>
        </defs>
        <g mask={`url(#${uid}-m)`}>
          <path d="M104 36 L32 66 V108 C32 162 68 204 128 234 C188 204 224 162 224 108 V66 L164 42" fill="none" stroke="var(--logo-flat)" strokeWidth="19" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M140 22 C88 39 57 61 57 91 C57 122 85 136 123 148 C153 157 176 168 180 187 C185 174 184 157 176 145 C166 128 147 120 128 113 C99 103 85 94 85 80 C85 65 105 54 140 43 Z" fill="var(--logo-flat)" />
        </g>
        <g fill="none" stroke="var(--logo-flat)" strokeWidth="17" strokeLinecap="round">
          <path d="M147 200 L180 226" />
          <circle cx="124" cy="177" r="32" />
        </g>
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 256 256" width={size} height={size} role="img" aria-label="Scam Shield" className={cn("shrink-0", className)}>
      <defs>
        <linearGradient id={`${uid}-r`} x1="85" y1="44" x2="183" y2="200" gradientUnits="userSpaceOnUse">
          <stop stopColor="#34C9E8" />
          <stop offset=".49" stopColor="#1764E8" />
          <stop offset="1" stopColor="var(--logo-ribbon-end)" />
        </linearGradient>
        <linearGradient id={`${uid}-f`} x1="82" y1="57" x2="181" y2="186" gradientUnits="userSpaceOnUse">
          <stop stopColor="#A8ECF8" />
          <stop offset=".55" stopColor="#34C9E8" />
          <stop offset="1" stopColor="#1764E8" />
        </linearGradient>
        <mask id={`${uid}-m`} maskUnits="userSpaceOnUse" x="0" y="0" width="256" height="256">
          <rect width="256" height="256" fill="white" />
          <circle cx="126" cy="176" r="42" fill="black" />
          <path d="M149 199 L176 226" fill="none" stroke="black" strokeWidth="26" strokeLinecap="round" />
        </mask>
      </defs>
      <g mask={`url(#${uid}-m)`}>
        <path d="M75 52 L36 68 V108 C36 162 70 203 128 232 C144 224 158 215 170 204 M210 153 C216 139 220 124 220 108 V68 L158 42" fill="none" stroke="var(--logo-outline)" strokeWidth="10" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M137 24 C100 36 64 57 64 87 C64 116 91 130 126 141 C160 152 183 166 183 185 C183 199 173 211 157 218 C184 214 202 194 202 170 C202 137 175 121 141 110 C109 100 88 91 88 76 C88 61 108 51 137 42 Z" fill={`url(#${uid}-r)`} />
        <path d="M137 24 C100 36 64 57 64 87 C64 116 91 130 126 141 C160 152 183 166 183 185 C183 198 173 211 157 218 C178 203 189 188 188 172 C187 145 162 132 131 122 C96 111 76 97 76 79 C76 57 104 40 137 24 Z" fill={`url(#${uid}-f)`} />
      </g>
      <g fill="none" stroke="var(--logo-outline)" strokeWidth="14" strokeLinecap="round">
        <path d="M149 199 L176 226" />
        <circle cx="126" cy="176" r="30" />
      </g>
    </svg>
  );
}
