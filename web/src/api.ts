import type { CheckRequest, CheckResult, EntityKey } from "@scam-shield/shared";
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

async function postJson<T>(path: string, body: unknown): Promise<T> {
  let token: string;
  try {
    const user = await ensureAnonymousUser();
    token = await user.getIdToken();
  } catch {
    throw new ApiError("unauthorized", 401);
  }

  let res: Response;
  try {
    res = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
  } catch {
    throw new ApiError("network", 0);
  }

  if (!res.ok) {
    let code: string | undefined;
    try {
      const data = (await res.json()) as { error?: unknown };
      if (typeof data.error === "string") code = data.error;
    } catch {
      // Not JSON (for example a proxy error page): fall back to the status.
    }
    throw new ApiError(code ?? (res.status === 401 ? "unauthorized" : "unknown"), res.status);
  }

  try {
    return (await res.json()) as T;
  } catch {
    throw new ApiError("unknown", res.status);
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
  "unauthorized",
  "network",
]);

/** i18n key for an error: known codes get their own message, anything else a generic one. */
export function errorMessageKey(err: unknown): MessageKey {
  if (err instanceof ApiError && FRIENDLY.has(err.code)) return `error.${err.code}` as MessageKey;
  if (err instanceof TypeError) return "error.network";
  return "error.unknown";
}
