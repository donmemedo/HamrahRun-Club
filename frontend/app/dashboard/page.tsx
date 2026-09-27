"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "motion/react";
import { Suspense, useCallback, useEffect, useState } from "react";
import { BatteryCharging, CarFront, CircleDot, Fuel, KeyRound, LifeBuoy, LogOut, Truck, Wrench } from "lucide-react";
import { MemberCard, Plans, Reveal, Sheet, useApp, type Plan } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import type { L10n } from "@/lib/i18n";

type Me = {
  phone: string; name: string; plan: string | null; car: string; km: number; member_no: string; plan_info: Plan | null;
  price: number; saved: number; payback: number;
  redemptions: { id: number; code: string; saved: number; at: number; deal: { title: L10n; partner: L10n; color: string } }[];
  assists: { id: number; kind: string; eta: number; at: number }[];
  reminders: { id: string; title: L10n; due_km: number; every: number }[];
};
const KINDS = { tow: Truck, battery: BatteryCharging, tire: CircleDot, fuel: Fuel, lockout: KeyRound } as const;

function Dashboard() {
  const { d, pick, num, compact, lang, token, setToken } = useApp();
  const router = useRouter();
  const params = useSearchParams();
  const [me, setMe] = useState<Me | null>(null);
  const [name, setName] = useState("");
  const [sos, setSos] = useState(params.get("sos") === "1");
  const [kind, setKind] = useState<keyof typeof KINDS>("battery");
  const [note, setNote] = useState("");
  const [eta, setEta] = useState<number | null>(null);

  const load = useCallback(() => api<Me>("/me").then((m) => { setMe(m); setName(m.name); }).catch((e) => {
    if (e instanceof ApiError && e.status === 401) { setToken(null); router.replace(`/login?next=/dashboard`); }
  }), [router, setToken]);

  useEffect(() => {
    if (!localStorage.getItem("token")) return router.replace(`/login?next=${encodeURIComponent(location.pathname + location.search)}`);
    const plan = params.get("plan");
    (plan ? api("/subscribe", { plan, period: params.get("period") ?? "yearly" }).then(() => router.replace("/dashboard")) : Promise.resolve())
      .finally(load);
  }, []); // eslint-disable-line

  useEffect(() => { if (params.get("sos") === "1") setSos(true); }, [params]);

  const subscribe = async (plan: string, period: string) => { await api("/subscribe", { plan, period }); load(); scrollTo({ top: 0, behavior: "smooth" }); };
  const sendSos = async () => { const r = await api<{ eta: number }>("/assist", { kind, note }); setEta(r.eta); load(); };
  const logout = async () => { await api("/auth/logout", {}).catch(() => {}); setToken(null); router.replace("/"); };

  if (!me || !token) return <div className="grid min-h-dvh place-items-center"><div className="size-10 animate-spin rounded-full border-4 border-line border-t-accent" /></div>;

  const pct = Math.round(me.payback * 100);
  const when = (ts: number) => new Intl.DateTimeFormat(lang === "fa" ? "fa-IR" : "en-US", { dateStyle: "medium" }).format(ts * 1000);

  return (
    <div className="mx-auto max-w-6xl px-5 pb-16 pt-28 md:pt-32">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-fg-2">{d.nav.dashboard}</p>
          <motion.h1 initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="tight text-4xl font-black md:text-5xl">{d.dash.hi(me.name || d.dash.friend)}</motion.h1>
        </div>
        <button onClick={logout} className="flex h-10 items-center gap-2 rounded-full px-4 text-sm font-medium text-fg-2 hover:bg-line hover:text-fg">
          <LogOut className="size-4 rtl:rotate-180" />{d.dash.logout}
        </button>
      </div>

      <div className="mt-8 grid gap-5 lg:grid-cols-[400px_1fr]">
        <div className="space-y-5">
          <MemberCard name={me.name || me.phone} no={me.member_no} plan={me.plan} />
          <button onClick={() => { setEta(null); setSos(true); }}
            className="group relative flex w-full items-center gap-4 overflow-hidden rounded-[28px] bg-gradient-to-br from-[#ff375f] to-[#ff9f0a] p-5 text-start text-white shadow-xl shadow-pink/30 transition active:scale-[.98]">
            <span className="relative grid size-14 shrink-0 place-items-center rounded-full bg-white/20">
              <span className="pulse-ring absolute inset-0 rounded-full bg-white/40" /><LifeBuoy className="relative size-7" />
            </span>
            <span><b className="block text-lg">{d.dash.sos}</b><span className="text-sm text-white/80">{d.dash.sosSub}</span></span>
          </button>
          <form onSubmit={async (e) => { e.preventDefault(); await api("/me", { name }, "PUT"); load(); }} className="surface flex gap-2 rounded-[22px] p-2">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder={d.dash.name} aria-label={d.dash.name}
              className="h-11 min-w-0 flex-1 rounded-2xl bg-transparent px-3 outline-none focus:bg-line" />
            <button className="h-11 rounded-2xl bg-fg px-5 text-sm font-semibold text-bg">{d.dash.save}</button>
          </form>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <Reveal className="surface relative overflow-hidden rounded-[28px] p-6">
            <div className="text-sm text-fg-2">{d.dash.saved}</div>
            <div className="mt-4 flex items-center gap-5">
              <div className="relative size-28 shrink-0">
                <svg viewBox="0 0 36 36" className="size-full -rotate-90">
                  <defs><linearGradient id="rg" x1="0" x2="1"><stop stopColor="#30d158" /><stop offset="1" stopColor="#64d2ff" /></linearGradient></defs>
                  <circle cx="18" cy="18" r="15.5" fill="none" stroke="var(--line)" strokeWidth="3.5" />
                  <motion.circle cx="18" cy="18" r="15.5" fill="none" stroke="url(#rg)" strokeWidth="3.5" strokeLinecap="round" pathLength={100}
                    initial={{ strokeDasharray: "0 100" }} animate={{ strokeDasharray: `${pct} 100` }} transition={{ duration: 1.6, ease: [0.2, 0.8, 0.2, 1] }} />
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

          <Reveal delay={0.05} className="surface rounded-[28px] p-6">
            <div className="flex items-center justify-between">
              <div className="text-sm text-fg-2">{d.dash.car}</div>
              <CarFront className="size-5 text-fg-2" />
            </div>
            <div className="mt-3 text-2xl font-bold">{pick({ fa: "دنا پلاس", en: me.car })}</div>
            <div className="tight mt-1 text-4xl font-black">{num(me.km)} <span className="text-base font-medium text-fg-2">{d.market.km}</span></div>
          </Reveal>

          <Reveal delay={0.1} className="surface rounded-[28px] p-6 sm:col-span-2">
            <div className="mb-4 flex items-center gap-2 text-sm text-fg-2"><Wrench className="size-4" />{d.dash.reminders}</div>
            <div className="grid gap-4 sm:grid-cols-3">
              {me.reminders.map((r) => {
                const left = r.due_km - me.km, p = 1 - left / r.every;
                return (
                  <div key={r.id}>
                    <div className="flex justify-between text-sm"><b>{pick(r.title)}</b></div>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-line">
                      <motion.div className={`h-full rounded-full ${p > 0.8 ? "bg-pink" : p > 0.5 ? "bg-[#ff9f0a]" : "bg-green"}`}
                        initial={{ width: 0 }} whileInView={{ width: `${p * 100}%` }} viewport={{ once: true }} transition={{ duration: 1.2 }} />
                    </div>
                    <div className="mt-1.5 text-xs text-fg-2">{d.dash.remain(num(left))}</div>
                  </div>
                );
              })}
            </div>
          </Reveal>

          <Reveal delay={0.15} className="surface rounded-[28px] p-6 sm:col-span-2">
            <div className="mb-3 text-sm text-fg-2">{d.dash.history}</div>
            {me.redemptions.length ? (
              <ul className="divide-y divide-line">
                {me.redemptions.slice(0, 6).map((r) => (
                  <li key={r.id} className="flex items-center gap-3 py-3">
                    <span className="size-10 shrink-0 rounded-xl" style={{ background: r.deal.color }} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-semibold">{pick(r.deal.title)}</div>
                      <div className="text-xs text-fg-2">{pick(r.deal.partner)} · {when(r.at)} · <span dir="ltr" className="font-mono">{r.code}</span></div>
                    </div>
                    <div className="text-sm font-bold text-green">+{compact(r.saved)}</div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="py-6 text-center text-fg-2">{d.dash.noHistory} <Link href="/deals" className="font-semibold text-accent">{d.dash.browse}</Link></div>
            )}
          </Reveal>
        </div>
      </div>

      {!me.plan && (
        <section className="mt-16">
          <h2 className="tight text-center text-3xl font-black">{d.dash.pickPlan}</h2>
          <div className="mt-8"><Plans onChoose={subscribe} /></div>
        </section>
      )}
      {me.plan && (
        <details className="mt-10 text-center">
          <summary className="cursor-pointer text-sm font-semibold text-accent">{d.nav.plans}</summary>
          <div className="mt-8 text-start"><Plans current={me.plan} onChoose={subscribe} /></div>
        </details>
      )}

      <Sheet open={sos} onClose={() => setSos(false)} label={d.sos.title}>
        {eta === null ? (
          <>
            <h2 className="text-xl font-bold">{d.sos.title}</h2>
            <div className="mt-5 grid grid-cols-3 gap-2.5">
              {(Object.keys(KINDS) as (keyof typeof KINDS)[]).map((k) => {
                const Icon = KINDS[k];
                return (
                  <button key={k} onClick={() => setKind(k)} aria-pressed={kind === k}
                    className={`flex flex-col items-center gap-2 rounded-2xl border p-3 text-xs font-medium transition active:scale-95 ${kind === k ? "border-pink bg-pink/10 text-pink" : "border-line text-fg-2"}`}>
                    <Icon className="size-6" />{d.sos.kinds[k]}
                  </button>
                );
              })}
            </div>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder={d.sos.note} rows={2}
              className="mt-4 w-full resize-none rounded-2xl border border-line bg-card-2 p-3 outline-none focus:ring-2 focus:ring-pink" />
            <button onClick={sendSos} className="mt-4 h-13 w-full rounded-full bg-gradient-to-r from-[#ff375f] to-[#ff9f0a] font-semibold text-white shadow-lg shadow-pink/30 active:scale-[.98]">{d.sos.send}</button>
          </>
        ) : (
          <div className="py-4 text-center">
            <div className="relative mx-auto grid size-32 place-items-center">
              {[0, 0.8, 1.6].map((delay) => <span key={delay} className="pulse-ring absolute inset-6 rounded-full bg-pink/40" style={{ animationDelay: `${delay}s` }} />)}
              <span className="relative grid size-16 place-items-center rounded-full bg-gradient-to-br from-[#ff375f] to-[#ff9f0a] text-white"><Truck className="size-8 rtl:-scale-x-100" /></span>
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

export default function Page() {
  return <Suspense><Dashboard /></Suspense>;
}
