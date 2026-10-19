"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { BatteryCharging, Check, CircleDot, Fuel, KeyRound, LifeBuoy, Loader2, LogOut, Truck, Wrench } from "lucide-react";
import { MemberCard, PeriodSwitch, Plans, Reveal, Sheet, useApp, type Period, type Plan } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import type { L10n } from "@/lib/i18n";

export type Me = {
  phone: string; name: string; plan: string | null; period: Period | null; plan_expires: number | null; car: string; km: number; member_no: string;
  price: number; saved: number; payback: number;
  redemptions: { id: number; code: string; saved: number; at: number; deal: { title: L10n; partner: L10n; color: string } }[];
  assists: { id: number; kind: string; eta: number; at: number }[];
  reminders: { id: string; title: L10n; due_km: number; every: number }[];
};
const KINDS = { tow: Truck, battery: BatteryCharging, tire: CircleDot, fuel: Fuel, lockout: KeyRound } as const;
const FREE_RESCUES = 3;
const field = "h-11 w-full rounded-2xl border border-line bg-card-2 px-3 outline-none focus:ring-2 focus:ring-accent";

export default function Dashboard({ me, plans, buy: wanted, sos: sosParam }: { me: Me; plans: Plan[]; buy: { plan: string; period: Period } | null; sos: boolean }) {
  const { d, pick, num, compact, lang, setAuthed, err } = useApp();
  const router = useRouter();
  const [profile, setProfile] = useState({ name: me.name, car: me.car, km: String(me.km) });
  const [saved, setSaved] = useState<"" | "busy" | "ok" | string>("");
  const [sos, setSos] = useState(sosParam);
  const [kind, setKind] = useState<keyof typeof KINDS>("battery");
  const [note, setNote] = useState("");
  const [eta, setEta] = useState<number | null>(null);
  const [sosBusy, setSosBusy] = useState(false);
  const [sosErr, setSosErr] = useState("");
  const [buy, setBuy] = useState<{ plan: Plan; period: Period } | null>(null);

  // Deep links (?sos=1, ?plan=…) open their sheet, then the URL is cleaned so a refresh does not reopen it.
  useEffect(() => {
    const plan = wanted && plans.find((p) => p.id === wanted.plan);
    if (plan) setBuy({ plan, period: wanted.period });
    if (sosParam) { setEta(null); setSos(true); }
    if (plan || sosParam) router.replace("/dashboard", { scroll: false });
  }, [wanted, sosParam]); // eslint-disable-line

  const expired = (e: unknown) => {
    if (!(e instanceof ApiError && e.status === 401)) return false;
    setAuthed(false);
    router.replace("/login?next=/dashboard");
    return true;
  };

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaved("busy");
    try {
      await api("/me", { name: profile.name, car: profile.car, km: Math.max(0, Math.round(+profile.km || 0)) }, "PUT");
      setSaved("ok");
      router.refresh();
    } catch (e) { if (!expired(e)) setSaved(err(e)); }
  };

  const serviceDone = async (id: string) => {
    try { await api(`/me/service/${id}`, {}); router.refresh(); } catch (e) { expired(e); }
  };

  const sendSos = async () => {
    setSosBusy(true); setSosErr("");
    try {
      const r = await api<{ eta: number }>("/assist", { kind, note });
      setEta(r.eta); setNote(""); router.refresh();
    } catch (e) { if (!expired(e)) setSosErr(err(e)); } finally { setSosBusy(false); }
  };

  const logout = async () => {
    await api("/auth/logout", {}).catch(() => {});
    setAuthed(false);
    router.replace("/");
    router.refresh();
  };

  const pct = Math.round(me.payback * 100);
  const date = (ts: number) => new Intl.DateTimeFormat(lang === "fa" ? "fa-IR" : "en-US", { dateStyle: "medium" }).format(ts * 1000);
  const rescuesLeft = Math.max(0, FREE_RESCUES - me.assists.filter((a) => a.at * 1000 > Date.now() - 365 * 864e5).length);

  return (
    <div className="mx-auto max-w-6xl px-5 pb-16 pt-28 md:pt-32">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-fg-2">{d.nav.dashboard}</p>
          <h1 className="tight text-4xl font-black md:text-5xl">{d.dash.hi(me.name || d.dash.friend)}</h1>
          {me.plan && me.plan_expires && <p className="mt-1 text-sm text-fg-2">{d.dash.until(date(me.plan_expires))}</p>}
        </div>
        <button onClick={logout} className="flex h-11 items-center gap-2 rounded-full px-4 text-sm font-medium text-fg-2 hover:bg-line hover:text-fg">
          <LogOut className="size-4 rtl:rotate-180" />{d.dash.logout}
        </button>
      </div>

      <div className="mt-8 grid gap-5 lg:grid-cols-[400px_1fr]">
        <div className="space-y-5">
          <MemberCard name={me.name || me.phone} no={me.member_no} plan={me.plan} />
          <button onClick={() => { setEta(null); setSosErr(""); setSos(true); }}
            className="flex w-full items-center gap-4 rounded-[28px] bg-gradient-to-br from-[#ff375f] to-[#ff9f0a] p-5 text-start text-white shadow-xl shadow-pink/30 transition active:scale-[.98]">
            <span className="grid size-14 shrink-0 place-items-center rounded-full bg-white/20"><LifeBuoy className="size-7" /></span>
            <span>
              <b className="block text-lg">{d.dash.sos}</b>
              <span className="text-sm text-white/90">{me.plan ? d.dash.sosLeft(num(rescuesLeft)) : d.dash.sosSub}</span>
            </span>
          </button>
          <form onSubmit={saveProfile} className="surface space-y-3 rounded-[28px] p-5">
            <div className="text-sm text-fg-2">{d.dash.profile}</div>
            <input value={profile.name} onChange={(e) => { setProfile({ ...profile, name: e.target.value }); setSaved(""); }} maxLength={60}
              placeholder={d.dash.name} aria-label={d.dash.name} className={field} />
            <div className="grid grid-cols-[1fr_8rem] gap-3">
              <input value={profile.car} onChange={(e) => { setProfile({ ...profile, car: e.target.value }); setSaved(""); }} minLength={2} maxLength={60} required
                placeholder={d.dash.carModel} aria-label={d.dash.carModel} className={field} />
              <input value={profile.km} onChange={(e) => { setProfile({ ...profile, km: e.target.value.replace(/\D/g, "").slice(0, 7) }); setSaved(""); }}
                inputMode="numeric" dir="ltr" placeholder={d.dash.km} aria-label={d.dash.km} className={field} />
            </div>
            <div className="flex items-center gap-3">
              <button disabled={saved === "busy"} className="flex h-11 items-center rounded-full bg-fg px-6 text-sm font-semibold text-bg active:scale-95 disabled:opacity-70">
                {saved === "busy" ? <Loader2 className="size-4 animate-spin" /> : d.dash.save}
              </button>
              <span aria-live="polite" className={`text-sm ${saved === "ok" ? "text-green" : "text-pink"}`}>
                {saved === "ok" ? <span className="flex items-center gap-1"><Check className="size-4" />{d.dash.saved_ok}</span> : saved !== "busy" && saved}
              </span>
            </div>
          </form>
        </div>

        <div className="grid content-start gap-5 sm:grid-cols-2">
          <Reveal className="surface rounded-[28px] p-6">
            <div className="text-sm text-fg-2">{d.dash.saved}</div>
            <div className="mt-4 flex items-center gap-5">
              <div className="relative size-28 shrink-0">
                <svg viewBox="0 0 36 36" className="size-full -rotate-90" aria-hidden>
                  <defs><linearGradient id="rg" x1="0" x2="1"><stop stopColor="#30d158" /><stop offset="1" stopColor="#64d2ff" /></linearGradient></defs>
                  <circle cx="18" cy="18" r="15.5" fill="none" stroke="var(--line)" strokeWidth="3.5" />
                  <motion.circle cx="18" cy="18" r="15.5" fill="none" stroke="url(#rg)" strokeWidth="3.5" strokeLinecap="round" pathLength={100}
                    initial={{ strokeDasharray: "0 100" }} animate={{ strokeDasharray: `${pct} 100` }} transition={{ duration: 1.2, ease: [0.2, 0.8, 0.2, 1] }} />
                </svg>
                <span className="absolute inset-0 grid place-items-center text-xl font-black">{pick({ fa: `٪${num(pct)}`, en: `${pct}%` })}</span>
              </div>
              <div>
                <div className="tight text-3xl font-black">{compact(me.saved)}</div>
                <div className="text-sm text-fg-2">{d.toman}</div>
                {me.plan && <div className="mt-2 text-xs font-medium text-green">{d.dash.payback(pick({ fa: `٪${num(pct)}`, en: `${pct}%` }))}</div>}
              </div>
            </div>
          </Reveal>

          <Reveal delay={0.04} className="surface rounded-[28px] p-6">
            <div className="text-sm text-fg-2">{d.dash.car}</div>
            <div className="mt-3 truncate text-2xl font-bold" dir="auto">{me.car}</div>
            <div className="tight mt-1 text-4xl font-black">{num(me.km)} <span className="text-base font-medium text-fg-2">{d.market.km}</span></div>
          </Reveal>

          <Reveal delay={0.08} className="surface rounded-[28px] p-6 sm:col-span-2">
            <div className="mb-4 flex items-center gap-2 text-sm text-fg-2"><Wrench className="size-4" aria-hidden />{d.dash.reminders}</div>
            <div className="grid gap-5 sm:grid-cols-3">
              {me.reminders.map((r) => {
                const left = r.due_km - me.km, p = Math.min(1, Math.max(0, 1 - left / r.every));
                return (
                  <div key={r.id}>
                    <div className="flex items-center justify-between gap-2 text-sm">
                      <b>{pick(r.title)}</b>
                      <button onClick={() => serviceDone(r.id)} className="h-9 rounded-full px-3 text-xs font-semibold text-accent hover:bg-accent/10">{d.dash.done}</button>
                    </div>
                    <div className="mt-1 h-2 overflow-hidden rounded-full bg-line" role="progressbar" aria-valuenow={Math.round(p * 100)} aria-valuemin={0} aria-valuemax={100} aria-label={pick(r.title)}>
                      <motion.div className={`h-full rounded-full ${p > 0.8 ? "bg-pink" : p > 0.5 ? "bg-[#ff9f0a]" : "bg-green"}`}
                        initial={{ width: 0 }} whileInView={{ width: `${p * 100}%` }} viewport={{ once: true }} />
                    </div>
                    <div className={`mt-1.5 text-xs ${left <= 0 ? "font-semibold text-pink" : "text-fg-2"}`}>{left <= 0 ? d.dash.overdue : d.dash.remain(num(left))}</div>
                  </div>
                );
              })}
            </div>
          </Reveal>

          <Reveal delay={0.12} className="surface rounded-[28px] p-6 sm:col-span-2">
            <div className="mb-3 text-sm text-fg-2">{d.dash.history}</div>
            {me.redemptions.length ? (
              <ul className="divide-y divide-line">
                {me.redemptions.slice(0, 6).map((r) => (
                  <li key={r.id} className="flex items-center gap-3 py-3">
                    <span className="size-10 shrink-0 rounded-xl" style={{ background: r.deal.color }} aria-hidden />
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-semibold">{pick(r.deal.title)}</div>
                      <div className="text-xs text-fg-2">{pick(r.deal.partner)} · {date(r.at)} · <span dir="ltr" className="font-mono">{r.code}</span></div>
                    </div>
                    <div className="text-sm font-bold text-green">+{compact(r.saved)}</div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="py-6 text-center text-fg-2">{d.dash.noHistory} <Link href="/deals" className="font-semibold text-accent">{d.dash.browse}</Link></div>
            )}
          </Reveal>

          {me.assists.length > 0 && (
            <Reveal delay={0.16} className="surface rounded-[28px] p-6 sm:col-span-2">
              <div className="mb-3 text-sm text-fg-2">{d.dash.assists}</div>
              <ul className="divide-y divide-line">
                {me.assists.map((a) => {
                  const Icon = KINDS[a.kind as keyof typeof KINDS] ?? LifeBuoy;
                  return (
                    <li key={a.id} className="flex items-center gap-3 py-3 text-sm">
                      <span className="grid size-10 place-items-center rounded-xl bg-pink/10 text-pink"><Icon className="size-5" aria-hidden /></span>
                      <span className="flex-1 font-semibold">{d.sos.kinds[a.kind]}</span>
                      <span className="text-fg-2">{date(a.at)}</span>
                    </li>
                  );
                })}
              </ul>
            </Reveal>
          )}
        </div>
      </div>

      <section id="plans" className="mt-16 scroll-mt-24">
        {!me.plan ? (
          <>
            <h2 className="tight mb-8 text-center text-3xl font-black">{d.dash.pickPlan}</h2>
            <Plans plans={plans} onChoose={(plan, period) => setBuy({ plan, period })} />
          </>
        ) : (
          <details className="text-center">
            <summary className="inline-flex h-11 cursor-pointer items-center text-sm font-semibold text-accent">{d.nav.plans}</summary>
            <div className="mt-8 text-start"><Plans plans={plans} current={me.plan} onChoose={(plan, period) => setBuy({ plan, period })} /></div>
          </details>
        )}
      </section>

      <BuySheet buy={buy} onClose={() => setBuy(null)} expired={expired} />

      <Sheet open={sos} onClose={() => setSos(false)} label={d.sos.title}>
        {!me.plan ? (
          <div className="pt-2 text-center">
            <p className="text-lg font-semibold">{d.sos.needPlan}</p>
            <a href="#plans" onClick={() => setSos(false)} className="mt-6 flex h-12 items-center justify-center rounded-full bg-accent font-semibold text-white">{d.hero.cta}</a>
          </div>
        ) : eta === null ? (
          <>
            <h2 className="text-xl font-bold">{d.sos.title}</h2>
            <p className="mt-1 text-sm text-fg-2">{d.dash.sosLeft(num(rescuesLeft))}</p>
            <div className="mt-5 grid grid-cols-3 gap-2.5" role="radiogroup" aria-label={d.sos.title}>
              {(Object.keys(KINDS) as (keyof typeof KINDS)[]).map((k) => {
                const Icon = KINDS[k];
                return (
                  <button key={k} role="radio" aria-checked={kind === k} onClick={() => setKind(k)}
                    className={`flex min-h-20 flex-col items-center justify-center gap-2 rounded-2xl border p-3 text-xs font-medium transition active:scale-95 ${kind === k ? "border-pink bg-pink/10 text-pink" : "border-line text-fg-2"}`}>
                    <Icon className="size-6" aria-hidden />{d.sos.kinds[k]}
                  </button>
                );
              })}
            </div>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder={d.sos.note} aria-label={d.sos.note} rows={2} maxLength={300}
              className="mt-4 w-full resize-none rounded-2xl border border-line bg-card-2 p-3 outline-none focus:ring-2 focus:ring-pink" />
            {sosErr && <p role="alert" className="mt-3 text-center text-sm font-medium text-pink">{sosErr}</p>}
            <button onClick={sendSos} disabled={sosBusy || rescuesLeft === 0}
              className="mt-4 flex h-12 w-full items-center justify-center rounded-full bg-gradient-to-r from-[#ff375f] to-[#ff9f0a] font-semibold text-white shadow-lg shadow-pink/30 active:scale-[.98] disabled:opacity-60">
              {sosBusy ? <Loader2 className="size-5 animate-spin" /> : d.sos.send}
            </button>
          </>
        ) : (
          <div className="py-4 text-center" aria-live="polite">
            <div className="relative mx-auto grid size-32 place-items-center">
              {[0, 0.8, 1.6].map((delay) => <span key={delay} className="pulse-ring absolute inset-6 rounded-full bg-pink/40" style={{ animationDelay: `${delay}s` }} />)}
              <span className="relative grid size-16 place-items-center rounded-full bg-gradient-to-br from-[#ff375f] to-[#ff9f0a] text-white"><Truck className="size-8 rtl:-scale-x-100" aria-hidden /></span>
            </div>
            <h2 className="mt-4 text-2xl font-bold">{d.sos.sent}</h2>
            <p className="mt-2 text-fg-2">{d.sos.eta(num(eta))}</p>
            <button onClick={() => setSos(false)} className="mt-6 h-12 w-full rounded-full bg-line font-semibold">{d.sos.close}</button>
          </div>
        )}
      </Sheet>
    </div>
  );
}

/** Purchase confirmation: shows exactly what will be charged before anything is charged. */
function BuySheet({ buy, onClose, expired }: { buy: { plan: Plan; period: Period } | null; onClose: () => void; expired: (e: unknown) => boolean }) {
  const { d, pick, num, err } = useApp();
  const router = useRouter();
  const last = useRef(buy);
  if (buy) last.current = buy; // keep content on screen while the sheet animates out
  const plan = last.current?.plan;
  const [period, setPeriod] = useState<Period>("yearly");
  const [vehicles, setVehicles] = useState("2");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [ref, setRef] = useState("");
  useEffect(() => { if (buy) { setPeriod(buy.period); setRef(""); setError(""); } }, [buy]);
  if (!plan) return <Sheet open={false} onClose={onClose} label={d.buy.title}>{null}</Sheet>;
  const count = plan.per_vehicle ? Math.min(20, Math.max(2, Math.round(+vehicles) || 2)) : 1; // same 2..20 clamp as the API
  const amount = plan[period] * count;

  const pay = async () => {
    setBusy(true); setError("");
    try {
      const co = await api<{ id: number }>("/checkout", { plan: plan.id, period, vehicles: count });
      const r = await api<{ ref: string }>(`/checkout/${co.id}/pay`, {});
      setRef(r.ref);
      router.refresh();
    } catch (e) { if (!expired(e)) setError(err(e)); } finally { setBusy(false); }
  };

  return (
    <Sheet open={!!buy} onClose={onClose} label={d.buy.title}>
      {ref ? (
        <div className="py-2 text-center" aria-live="polite">
          <motion.div initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="mx-auto grid size-16 place-items-center rounded-full bg-green text-white">
            <Check className="size-8" strokeWidth={3} aria-hidden />
          </motion.div>
          <h2 className="mt-4 text-xl font-bold">{d.buy.paid}</h2>
          <p className="mt-2 text-sm text-fg-2">{d.buy.ref}: <span dir="ltr" className="font-mono">{ref}</span></p>
          <button onClick={onClose} className="mt-6 h-12 w-full rounded-full bg-accent font-semibold text-white">{d.buy.close}</button>
        </div>
      ) : (
        <>
          <h2 className="text-xl font-bold">{d.buy.title}</h2>
          <div className="mt-5 flex items-center justify-between gap-3">
            <b className="text-lg">{pick(plan.name)}</b>
            <PeriodSwitch period={period} onChange={setPeriod} />
          </div>
          {plan.per_vehicle && (
            <label className="mt-4 flex items-center justify-between gap-3 text-sm">
              {d.buy.vehicles}
              <input type="number" min={2} max={20} value={vehicles} dir="ltr"
                onChange={(e) => setVehicles(e.target.value)} onBlur={() => setVehicles(String(count))}
                className="h-11 w-24 rounded-2xl border border-line bg-card-2 px-3 text-center outline-none focus:ring-2 focus:ring-accent" />
            </label>
          )}
          <div className="my-5 h-px bg-line" />
          <div className="flex items-baseline justify-between">
            <span className="text-sm text-fg-2">{d.buy.amount}</span>
            <span className="tight text-2xl font-black">{num(amount)} <span className="text-sm font-medium text-fg-2">{d.toman}</span></span>
          </div>
          {error && <p role="alert" className="mt-4 text-center text-sm font-medium text-pink">{error}</p>}
          <button onClick={pay} disabled={busy} className="mt-5 flex h-12 w-full items-center justify-center rounded-full bg-accent font-semibold text-white shadow-lg shadow-accent/30 active:scale-[.98] disabled:opacity-70">
            {busy ? <Loader2 className="size-5 animate-spin" /> : d.buy.pay}
          </button>
        </>
      )}
    </Sheet>
  );
}
