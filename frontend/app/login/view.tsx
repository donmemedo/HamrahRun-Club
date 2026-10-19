"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import { ArrowRight, Loader2, Smartphone } from "lucide-react";
import { Logo, useApp } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import { safeNext } from "@/lib/safe-next";

const LEN = 6;
const DIGITS: Record<string, string> = Object.fromEntries([..."۰۱۲۳۴۵۶۷۸۹", ..."٠١٢٣٤٥٦٧٨٩"].map((c, i) => [c, String(i % 10)]));
const toLatin = (s: string) => s.replace(/[۰-۹٠-٩]/g, (c) => DIGITS[c]);
// 09123456789 -> "0912 345 6789", grouped the way people read it back
const digitsOf = (s: string) => toLatin(s).replace(/\D/g, "").replace(/^(0098|98)/, "0").slice(0, 11);
const group = (s: string) => [s.slice(0, 4), s.slice(4, 7), s.slice(7)].filter(Boolean).join(" ");

export default function LoginForm() {
  const { d, num, setAuthed, err } = useApp();
  const router = useRouter();
  const next = safeNext(useSearchParams().get("next"));
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [focus, setFocus] = useState(false);
  const [demo, setDemo] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [left, setLeft] = useState(0);

  useEffect(() => {
    if (left <= 0) return;
    const id = setTimeout(() => setLeft(left - 1), 1000);
    return () => clearTimeout(id);
  }, [left]);

  const fail = (e: unknown) => {
    if (e instanceof ApiError && e.retryAfter) setLeft(e.retryAfter);
    setError(err(e));
  };

  const send = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!phone) return setError(d.auth.empty);
    if (!/^09\d{9}$/.test(phone)) return setError(d.errors.invalid_phone); // inline, before a round trip
    setBusy(true); setError("");
    try {
      const r = await api<{ demo_code?: string; ttl: number }>("/auth/otp", { phone });
      setDemo(r.demo_code ?? ""); setStep("code"); setCode(""); setLeft(60);
    } catch (e) { fail(e); } finally { setBusy(false); }
  };

  const verify = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (code.length < LEN) return setError(d.auth.empty);
    setBusy(true); setError("");
    try {
      await api("/auth/verify", { phone, code });
      setAuthed(true);
      router.replace(next);
    } catch (e) { fail(e); setCode(""); setBusy(false); }
  };

  useEffect(() => { if (code.length === LEN && step === "code") verify(); }, [code]); // eslint-disable-line

  return (
    <div className="grain relative isolate flex min-h-dvh items-center justify-center overflow-hidden px-5 py-28">
      <div className="aurora" />
      <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}
        className="glass relative w-full max-w-sm rounded-[28px] border border-line p-8 shadow-2xl">
        <Link href="/" className="absolute start-3 top-3 flex h-11 items-center gap-1 rounded-full px-3 text-sm text-fg-2 hover:text-fg">
          <ArrowRight className="size-4 ltr:rotate-180" />{d.auth.back}
        </Link>
        <Logo className="mx-auto size-14" />
        <AnimatePresence mode="wait" initial={false}>
          {step === "phone" ? (
            <motion.form key="p" onSubmit={send} noValidate initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }}>
              <h1 className="mt-5 text-center text-2xl font-bold">{d.auth.title}</h1>
              <p className="mt-1 text-center text-sm text-fg-2">{d.auth.sub}</p>
              <label className="mt-7 flex h-14 items-center gap-2 rounded-2xl border border-line bg-card px-4 focus-within:ring-2 focus-within:ring-accent">
                <Smartphone className="size-5 text-fg-2" aria-hidden />
                <input dir="ltr" autoFocus inputMode="tel" autoComplete="tel" aria-label={d.auth.phone} placeholder="0912 345 6789"
                  aria-invalid={!!error} value={group(phone)} onChange={(e) => { setPhone(digitsOf(e.target.value)); setError(""); }}
                  className="h-full w-full bg-transparent text-lg tracking-wider outline-none placeholder:text-fg-2/70" />
              </label>
              <Submit busy={busy} label={d.auth.send} />
            </motion.form>
          ) : (
            <motion.form key="c" onSubmit={verify} initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }}>
              <h1 className="mt-5 text-center text-2xl font-bold">{d.auth.codeTitle}</h1>
              <p className="mt-1 text-center text-sm text-fg-2">{d.auth.codeSub(group(phone))}</p>
              <div className="relative mt-7" dir="ltr">
                <input autoFocus inputMode="numeric" autoComplete="one-time-code" maxLength={LEN} aria-label={d.auth.codeTitle}
                  value={code} onFocus={() => setFocus(true)} onBlur={() => setFocus(false)}
                  onChange={(e) => { setCode(toLatin(e.target.value).replace(/\D/g, "").slice(0, LEN)); setError(""); }}
                  className="absolute inset-0 z-10 opacity-0" />
                <div className="grid grid-cols-6 gap-2" aria-hidden>
                  {Array.from({ length: LEN }, (_, i) => (
                    <div key={i} className={`grid h-14 place-items-center rounded-2xl border bg-card text-2xl font-bold transition ${focus && code.length === i ? "border-accent ring-2 ring-accent/40" : "border-line"}`}>
                      {code[i] ? num(+code[i]) : ""}
                    </div>
                  ))}
                </div>
              </div>
              {demo && <p className="mt-4 rounded-xl bg-accent/10 py-2 text-center text-sm text-accent">{d.auth.demo}: <b className="font-mono">{demo.replace(/\d/g, (c) => num(+c))}</b></p>}
              <Submit busy={busy} label={d.auth.verify} />
              <div className="mt-2 flex justify-between text-sm">
                <button type="button" onClick={() => { setStep("phone"); setError(""); }} className="h-11 px-1 text-accent">{d.auth.edit}</button>
                <button type="button" disabled={left > 0 || busy} onClick={() => send()} className="h-11 px-1 text-accent disabled:text-fg-2">
                  {left > 0 ? d.auth.resendIn(num(left)) : d.auth.resend}
                </button>
              </div>
            </motion.form>
          )}
        </AnimatePresence>
        <AnimatePresence>{error && <motion.p role="alert" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-4 text-center text-sm font-medium text-pink">{error}</motion.p>}</AnimatePresence>
        <p className="mt-6 text-center text-xs leading-5 text-fg-2">{d.auth.terms}</p>
      </motion.div>
    </div>
  );
}

function Submit({ busy, label }: { busy: boolean; label: string }) {
  return (
    <button disabled={busy} className="mt-5 flex h-12 w-full items-center justify-center rounded-full bg-accent font-semibold text-white shadow-lg shadow-accent/30 transition hover:brightness-110 active:scale-[.98] disabled:opacity-70">
      {busy ? <Loader2 className="size-5 animate-spin" /> : label}
    </button>
  );
}
