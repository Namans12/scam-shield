import { useEffect, useId, useRef, useState } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { INDIAN_STATES } from "@scam-shield/shared/states";
import type { CheckResult } from "@scam-shield/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ApiError, errorMessageKey, reportCheck } from "@/api";
import { ensureAnonymousUser, isGoogleUser, signInWithGoogle } from "@/firebase";
import { useT, type MessageKey } from "@/i18n";

/** Maps a failed report to the message the person sees. */
export function reportErrorKey(err: unknown): MessageKey {
  if (err instanceof ApiError) {
    switch (err.code) {
      case "google_sign_in_required": return "report.error.sessionChanged";
      case "no_identifiers": return "report.error.noIds";
      case "not_reportable": return "report.error.notReportable";
      case "rate_limited":
      case "network":
      case "unauthorized": return errorMessageKey(err);
    }
  } else if (err instanceof TypeError) return "error.network";
  return "report.error.generic";
}

const SELECT_CLASS =
  "h-12 w-full rounded-xl border border-input bg-background px-3 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

interface Props {
  result: CheckResult;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Adds the identifiers of a checked scam to the shared list. Needs a Google sign-in (limits fake reports). */
export function ReportDialog({ result, open, onOpenChange }: Props) {
  const t = useT();
  const ids = useId();
  const mounted = useRef(true);
  const returnFocus = useRef<HTMLElement | null>(null);
  const [google, setGoogle] = useState(false);
  const [phase, setPhase] = useState<"idle" | "signing" | "sending" | "done">("idle");
  const [errorKey, setErrorKey] = useState<MessageKey | null>(null);
  const [state, setState] = useState("");
  const [city, setCity] = useState("");

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  // Whether this visitor is already signed in with Google (checked each time the dialog opens).
  useEffect(() => {
    if (!open) return;
    let live = true;
    ensureAnonymousUser().then((u) => live && setGoogle(isGoogleUser(u)), () => undefined);
    return () => {
      live = false;
    };
  }, [open]);

  async function onSignIn() {
    setErrorKey(null);
    setPhase("signing");
    try {
      const before = await ensureAnonymousUser();
      const user = await signInWithGoogle();
      if (!mounted.current) return;
      setGoogle(true);
      // Signing in to an existing Google account changes the user id, and this check belongs to the old one.
      if (user.uid !== before.uid) setErrorKey("report.error.sessionChanged");
    } catch (e) {
      const code = typeof e === "object" && e !== null && "code" in e ? String((e as { code: unknown }).code) : "";
      const quiet = code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request";
      if (mounted.current && !quiet) setErrorKey("report.error.signin");
    } finally {
      if (mounted.current) setPhase("idle");
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (phase !== "idle") return;
    setErrorKey(null);
    setPhase("sending");
    try {
      await reportCheck(result.id, { ...(state && { state }), ...(city.trim() && { city: city.trim() }) });
      if (mounted.current) setPhase("done");
    } catch (err) {
      if (!mounted.current) return;
      setErrorKey(reportErrorKey(err));
      setPhase("idle");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-h-[90vh] w-[calc(100%_-_2rem)] max-w-lg overflow-y-auto rounded-3xl border-border p-6 shadow-xl sm:p-8"
        onOpenAutoFocus={() => {
          returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        }}
        onCloseAutoFocus={(event) => {
          // This controlled dialog is opened from the result actions, without a Radix trigger.
          if (returnFocus.current?.isConnected) {
            event.preventDefault();
            returnFocus.current.focus();
          }
        }}
      >
        <DialogHeader>
          <DialogTitle className="pr-8 text-2xl font-bold leading-relaxed tracking-tight">{t("report.title")}</DialogTitle>
          <DialogDescription className="mt-3 text-base leading-relaxed">{t("report.intro")}</DialogDescription>
        </DialogHeader>

        {phase === "done" ? (
          <div className="flex flex-col gap-4">
            <p role="status" className="flex items-start gap-2 text-lg font-semibold text-nosigns-fg">
              <CheckCircle2 className="mt-0.5 shrink-0" aria-hidden />
              {t("report.done")}
            </p>
            <Button size="lg" onClick={() => onOpenChange(false)}>
              {t("report.close")}
            </Button>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="flex flex-col gap-4">
            {!google ? (
              <div className="flex flex-col gap-4 rounded-2xl border border-border bg-secondary/50 p-4">
                <p className="text-base">{t("report.signInNote")}</p>
                <Button type="button" size="lg" onClick={onSignIn} disabled={phase === "signing"}>
                  {phase === "signing" && <Loader2 className="motion-safe:animate-spin" aria-hidden />}
                  {phase === "signing" ? t("report.signingIn") : t("report.signIn")}
                </Button>
              </div>
            ) : (
              <>
                <div>
                  <label htmlFor={`${ids}-state`} className="mb-1 block text-base font-semibold">
                    {t("report.state")}
                  </label>
                  <select id={`${ids}-state`} className={SELECT_CLASS} value={state} onChange={(e) => setState(e.target.value)}>
                    <option value="">{t("report.stateNone")}</option>
                    {INDIAN_STATES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor={`${ids}-city`} className="mb-1 block text-base font-semibold">
                    {t("report.city")}
                  </label>
                  <Input id={`${ids}-city`} value={city} maxLength={60} autoComplete="off" onChange={(e) => setCity(e.target.value)} />
                </div>
                <Button type="submit" size="lg" disabled={phase === "sending"}>
                  {phase === "sending" && <Loader2 className="motion-safe:animate-spin" aria-hidden />}
                  {phase === "sending" ? t("report.submitting") : t("report.submit")}
                </Button>
              </>
            )}
            {errorKey && (
              <p role="alert" className="rounded-xl border-l-8 border-scam bg-scam-bg p-3 text-base text-scam-fg">
                {t(errorKey)}
              </p>
            )}
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
