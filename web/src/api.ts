import type { CheckRequest, CheckResult, EntityKey } from "@scam-shield/shared";
import type { User } from "firebase/auth";
import { ensureAnonymousUser } from "./firebase";
import type { MessageKey } from "./i18n/en";

/** Error from the API. `code` is the `{error}` string the server sent, or "network"/"unknown". */
export class ApiError extends Error {
  status: number;
  code: string;

  constructor(code: string, status = 0, message?: string) {
    super(message ?? code);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
  }
}

/** The server answers within 45 s (Hosting rewrites cut off at 60 s); give up a little after that. */
export const REQUEST_TIMEOUT_MS = 70_000;

async function send(path: string, body: unknown, user: User, forceRefresh: boolean, signal: AbortSignal): Promise<Response> {
  let token: string;
  try {
    token = await user.getIdToken(forceRefresh);
  } catch {
    throw new ApiError("unauthorized", 401);
  }
  try {
    return await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
      signal,
    });
  } catch {
    // Offline, DNS failure, or our own timeout abort.
    throw new ApiError("network", 0);
  }
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  let user: User;
  try {
    user = await ensureAnonymousUser();
  } catch {
    throw new ApiError("unauthorized", 401);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    let res = await send(path, body, user, false, controller.signal);
    // A 401 can just mean the cached ID token expired: refresh it and try once more.
    if (res.status === 401) res = await send(path, body, user, true, controller.signal);

    if (!res.ok) {
      let code: string | undefined;
      try {
        const data = (await res.json()) as { error?: unknown };
        if (typeof data.error === "string") code = data.error;
      } catch {
        // Not JSON (for example a proxy error page): fall back to the status.
      }
      if (controller.signal.aborted) throw new ApiError("network", 0);
      throw new ApiError(code ?? (res.status === 401 ? "unauthorized" : res.status === 429 ? "rate_limited" : "unknown"), res.status);
    }

    try {
      return (await res.json()) as T;
    } catch {
      throw new ApiError(controller.signal.aborted ? "network" : "unknown", controller.signal.aborted ? 0 : res.status);
    }
  } finally {
    clearTimeout(timer);
  }
}

export function checkContent(req: CheckRequest): Promise<CheckResult> {
  return postJson<CheckResult>("/api/check", req);
}

export function reportCheck(
  checkId: string,
  place?: { state?: string; city?: string },
): Promise<{ reportId: string; entityKeys: EntityKey[] }> {
  return postJson("/api/report", { checkId, ...place });
}

const FRIENDLY = new Set([
  "rate_limited",
  "daily_limit",
  "analysis_failed",
  "empty_input",
  "text_too_long",
  "bad_url",
  "unsupported_type",
  "file_too_large",
  "upload_failed",
  "unauthorized",
  "network",
]);

/** i18n key for an error: known codes get their own message, anything else a generic one. */
export function errorMessageKey(err: unknown): MessageKey {
  if (err instanceof ApiError && FRIENDLY.has(err.code)) return `error.${err.code}` as MessageKey;
  if (err instanceof TypeError) return "error.network";
  return "error.unknown";
}
