"use client";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Loader2, Smartphone } from "lucide-react";
import { Logo, useApp } from "@/components/ui";
import { api, ApiError } from "@/lib/api";

const toLatin = (s: string) => s.replace(/[۰-۹]/g, (c) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(c)));

function LoginForm() {
  const { d, num, setToken } = useApp();
  const router = useRouter();
  const raw = useSearchParams().get("next") ?? "";
  const next = raw.startsWith("/") && !raw.startsWith("//") ? raw : "/dashboard"; // local paths only: no open redirect
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [demo, setDemo] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [left, setLeft] = useState(0);

  useEffect(() => {
    if (left <= 0) return;
    const id = setTimeout(() => setLeft(left - 1), 1000);
    return () => clearTimeout(id);
  }, [left]);

  const fail = (e: unknown) => setErr(e instanceof ApiError && e.message in d.auth ? (d.auth as any)[e.message] : d.error);

  const send = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!phone.trim()) return setErr(d.auth.empty);
    setBusy(true); setErr("");
    try {
      const r = await api<{ demo_code?: string; ttl: number }>("/auth/otp", { phone: toLatin(phone) });
      setDemo(r.demo_code ?? ""); setStep("code"); setCode(""); setLeft(60);
    } catch (e) { fail(e); } finally { setBusy(false); }
  };

  const verify = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (code.length < 4) return setErr(d.auth.empty);
    setBusy(true); setErr("");
    try {
      const r = await api<{ token: string }>("/auth/verify", { phone: toLatin(phone), code });
      setToken(r.token);
      router.replace(next);
    } catch (e) { fail(e); setBusy(false); }
  };

  useEffect(() => { if (code.length === 4 && step === "code") verify(); }, [code]); // eslint-disable-line

  return (
    <div className="grain relative isolate flex min-h-dvh items-center justify-center overflow-hidden px-5 py-28">
      <div className="aurora"><i /><i /><i /></div>
      <motion.div initial={{ opacity: 0, y: 30, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ type: "spring", bounce: 0.25 }}
        className="glass relative w-full max-w-sm rounded-[32px] border border-line p-8 shadow-2xl">
        <Logo className="mx-auto size-14" />
        <AnimatePresence mode="wait">
          {step === "phone" ? (
            <motion.form key="p" onSubmit={send} initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }}>
              <h1 className="mt-5 text-center text-2xl font-bold">{d.auth.title}</h1>
              <p className="mt-1 text-center text-sm text-fg-2">{d.auth.sub}</p>
              <label className="mt-7 flex h-14 items-center gap-2 rounded-2xl border border-line bg-card px-4 focus-within:ring-2 focus-within:ring-accent">
                <Smartphone className="size-5 text-fg-2" />
                <input dir="ltr" autoFocus inputMode="tel" autoComplete="tel" aria-label={d.auth.phone} placeholder="0912 345 6789"
                  value={phone} onChange={(e) => { setPhone(e.target.value); setErr(""); }}
                  className="h-full w-full bg-transparent text-lg tracking-wider outline-none placeholder:text-fg-2/60" />
              </label>
              <Submit busy={busy} label={d.auth.send} />
            </motion.form>
          ) : (
            <motion.form key="c" onSubmit={verify} initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }}>
              <h1 className="mt-5 text-center text-2xl font-bold">{d.auth.codeTitle}</h1>
              <p className="mt-1 text-center text-sm text-fg-2">{d.auth.codeSub(phone)}</p>
              <div className="relative mt-7" dir="ltr">
                <input autoFocus inputMode="numeric" autoComplete="one-time-code" maxLength={4} aria-label={d.auth.codeTitle}
                  value={code} onChange={(e) => { setCode(toLatin(e.target.value).replace(/\D/g, "").slice(0, 4)); setErr(""); }}
                  className="absolute inset-0 z-10 opacity-0" />
                <div className="grid grid-cols-4 gap-3">
                  {[0, 1, 2, 3].map((i) => (
                    <div key={i} className={`grid h-16 place-items-center rounded-2xl border bg-card text-2xl font-bold transition ${code.length === i ? "border-accent ring-2 ring-accent/30" : "border-line"}`}>
                      {code[i] ? num(+code[i]) : ""}
                    </div>
                  ))}
                </div>
              </div>
              {demo && <p className="mt-4 rounded-xl bg-accent/10 py-2 text-center text-sm text-accent">{d.auth.demo}: <b className="font-mono">{demo.replace(/\d/g, (c) => num(+c))}</b></p>}
              <Submit busy={busy} label={d.auth.verify} />
              <div className="mt-4 flex justify-between text-sm">
                <button type="button" onClick={() => { setStep("phone"); setErr(""); }} className="text-accent">{d.auth.edit}</button>
                <button type="button" disabled={left > 0} onClick={() => send()} className="text-accent disabled:text-fg-2">
                  {left > 0 ? d.auth.resendIn(num(left)) : d.auth.resend}
                </button>
              </div>
            </motion.form>
          )}
        </AnimatePresence>
        <AnimatePresence>{err && <motion.p role="alert" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-4 text-center text-sm font-medium text-pink">{err}</motion.p>}</AnimatePresence>
        <p className="mt-6 text-center text-xs leading-5 text-fg-2">{d.auth.terms}</p>
      </motion.div>
    </div>
  );
}

function Submit({ busy, label }: { busy: boolean; label: string }) {
  return (
    <button disabled={busy} className="mt-5 flex h-13 w-full items-center justify-center rounded-full bg-accent font-semibold text-white shadow-lg shadow-accent/30 transition hover:brightness-110 active:scale-[.98] disabled:opacity-70">
      {busy ? <Loader2 className="size-5 animate-spin" /> : label}
    </button>
  );
}

export default function Login() {
  return <Suspense><LoginForm /></Suspense>;
}
