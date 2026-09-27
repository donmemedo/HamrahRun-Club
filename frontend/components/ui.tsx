"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { createContext, useContext, useEffect, useId, useRef, useState, type ReactNode } from "react";
import {
  BatteryCharging, Car, CircleDot, Droplets, Fuel, Home, Languages, LifeBuoy, Moon, PlugZap, ScanLine,
  Shield, ShieldCheck, ShoppingBag, Sparkles, Sun, Tag, User, Wrench, X, Zap, type LucideIcon,
} from "lucide-react";
import { dicts, type Dict, type L10n, type Lang } from "@/lib/i18n";
import { api } from "@/lib/api";

type Ctx = {
  lang: Lang; d: Dict; setLang: (l: Lang) => void; pick: (v: L10n) => string;
  num: (n: number) => string; compact: (n: number) => string;
  token: string | null; setToken: (t: string | null) => void;
};
const AppCtx = createContext<Ctx>(null!);
export const useApp = () => useContext(AppCtx);

const setCookie = (k: string, v: string) => { document.cookie = `${k}=${v}; path=/; max-age=31536000; samesite=lax`; };

export function Providers({ lang: initial, children }: { lang: Lang; children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(initial);
  const [token, setTokenState] = useState<string | null>(null);
  useEffect(() => { try { setTokenState(localStorage.getItem("token")); } catch {} }, []);
  const loc = lang === "fa" ? "fa-IR" : "en-US";
  const value: Ctx = {
    lang, d: dicts[lang],
    setLang: (l) => {
      setCookie("lang", l);
      document.documentElement.lang = l;
      document.documentElement.dir = l === "fa" ? "rtl" : "ltr";
      setLangState(l);
    },
    pick: (v) => v[lang],
    num: (n) => new Intl.NumberFormat(loc).format(n),
    compact: (n) => new Intl.NumberFormat(loc, { notation: "compact", maximumFractionDigits: 1 }).format(n),
    token,
    setToken: (t) => {
      try { t ? localStorage.setItem("token", t) : localStorage.removeItem("token"); } catch {}
      setTokenState(t);
    },
  };
  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>;
}

export function Logo({ className = "size-8" }: { className?: string }) {
  const id = useId();
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#0a84ff" /><stop offset=".55" stopColor="#5e5ce6" /><stop offset="1" stopColor="#ff375f" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="9" fill={`url(#${id})`} />
      <path d="M8.5 23c2.5-7 6-8 8-7.5s5 .5 7-7" stroke="#fff" strokeWidth="3" fill="none" strokeLinecap="round" />
      <circle cx="8.5" cy="23" r="2.2" fill="#fff" /><circle cx="23.5" cy="8.5" r="2.2" fill="#fff" />
    </svg>
  );
}

function ThemeToggle() {
  const { d } = useApp();
  const [dark, setDark] = useState<boolean | null>(null);
  useEffect(() => {
    const t = document.documentElement.dataset.theme;
    setDark(t ? t === "dark" : matchMedia("(prefers-color-scheme: dark)").matches);
  }, []);
  const toggle = (e: React.MouseEvent) => {
    const next = dark ? "light" : "dark";
    const apply = () => { document.documentElement.dataset.theme = next; setCookie("theme", next); setDark(!dark); };
    const vt = (document as any).startViewTransition;
    if (!vt || matchMedia("(prefers-reduced-motion: reduce)").matches) return apply();
    const { clientX: x, clientY: y } = e;
    const r = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
    vt.call(document, apply).ready.then(() =>
      document.documentElement.animate(
        { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${r}px at ${x}px ${y}px)`] },
        { duration: 650, easing: "cubic-bezier(.2,.8,.2,1)", pseudoElement: "::view-transition-new(root)" },
      ));
  };
  return (
    <button onClick={toggle} aria-label={dark ? d.theme.light : d.theme.dark} title={dark ? d.theme.light : d.theme.dark}
      className="grid size-9 place-items-center rounded-full text-fg-2 transition hover:bg-line hover:text-fg active:scale-90">
      <AnimatePresence mode="wait" initial={false}>
        <motion.span key={String(dark)} initial={{ rotate: -90, scale: 0.5, opacity: 0 }} animate={{ rotate: 0, scale: 1, opacity: 1 }}
          exit={{ rotate: 90, scale: 0.5, opacity: 0 }} transition={{ duration: 0.25 }}>
          {dark ? <Sun className="size-[18px]" /> : <Moon className="size-[18px]" />}
        </motion.span>
      </AnimatePresence>
    </button>
  );
}

function LangToggle() {
  const { lang, setLang } = useApp();
  return (
    <button onClick={() => setLang(lang === "fa" ? "en" : "fa")} aria-label="Language / زبان"
      className="flex h-9 items-center gap-1 rounded-full px-2.5 text-[13px] font-semibold text-fg-2 transition hover:bg-line hover:text-fg active:scale-95">
      <Languages className="size-4" />{lang === "fa" ? "EN" : "فا"}
    </button>
  );
}

export function Nav() {
  const { d, token } = useApp();
  const path = usePathname();
  const links = [["/", d.nav.home], ["/deals", d.nav.deals], ["/market", d.nav.market], ["/#plans", d.nav.plans]] as const;
  return (
    <header className="fixed inset-x-0 top-0 z-50 flex justify-center px-3 pt-3 md:pt-4">
      <nav className="glass flex h-14 w-full max-w-5xl items-center gap-2 rounded-full border border-line px-2 ps-3 shadow-[var(--shadow)]">
        <Link href="/" className="flex items-center gap-2 pe-2 font-bold">
          <Logo />
          <span className="text-[17px]">{d.brand}</span>
        </Link>
        <div className="mx-auto hidden items-center gap-1 md:flex">
          {links.map(([href, label]) => {
            const active = href === path;
            return (
              <Link key={href} href={href} className={`relative rounded-full px-4 py-2 text-sm transition ${active ? "text-fg" : "text-fg-2 hover:text-fg"}`}>
                {active && <motion.span layoutId="nav-pill" className="absolute inset-0 rounded-full bg-line" transition={{ type: "spring", bounce: 0.25, duration: 0.5 }} />}
                <span className="relative">{label}</span>
              </Link>
            );
          })}
        </div>
        <div className="ms-auto flex items-center gap-0.5 md:ms-0">
          <LangToggle />
          <ThemeToggle />
          <Link href={token ? "/dashboard" : "/login"}
            className="ms-1 hidden h-10 items-center rounded-full bg-fg px-5 text-sm font-semibold text-bg transition hover:opacity-85 active:scale-95 sm:flex">
            {token ? d.nav.dashboard : d.nav.login}
          </Link>
        </div>
      </nav>
    </header>
  );
}

export function TabBar() {
  const { d, token } = useApp();
  const path = usePathname();
  const tabs: [string, string, LucideIcon][] = [
    ["/", d.nav.home, Home], ["/deals", d.nav.deals, Tag], ["/dashboard?sos=1", d.nav.sos, LifeBuoy],
    ["/market", d.nav.market, ShoppingBag], [token ? "/dashboard" : "/login", d.nav.account, User],
  ];
  return (
    <nav className="glass pb-safe fixed inset-x-0 bottom-0 z-50 border-t border-line md:hidden">
      <div className="mx-auto flex max-w-md items-end justify-around px-2 pt-1.5">
        {tabs.map(([href, label, Icon], i) =>
          i === 2 ? (
            <Link key={href} href={href} aria-label={label} className="-mt-6 flex flex-col items-center gap-1 text-[10px] font-medium text-fg-2">
              <span className="relative grid size-14 place-items-center rounded-full bg-gradient-to-br from-[#ff375f] to-[#ff9f0a] text-white shadow-lg shadow-pink/40 transition active:scale-90">
                <span className="pulse-ring absolute inset-0 rounded-full bg-pink/40" />
                <Icon className="relative size-6" />
              </span>
              {label}
            </Link>
          ) : (
            <Link key={href} href={href} className={`flex w-16 flex-col items-center gap-1 py-1 text-[10px] font-medium transition active:scale-90 ${path === href.split("?")[0] ? "text-accent" : "text-fg-2"}`}>
              <Icon className="size-6" strokeWidth={path === href ? 2.2 : 1.8} />
              {label}
            </Link>
          ),
        )}
      </div>
    </nav>
  );
}

const CARD_SKINS: Record<string, string> = {
  plus: "from-[#1a1033] via-[#2b1055] to-[#6b1d4f]",
  standard: "from-[#062a57] via-[#0a4ea3] to-[#0a84ff]",
  fleet: "from-[#0b2a1f] via-[#11493a] to-[#1f7a5a]",
  none: "from-[#1c1c1e] via-[#2c2c2e] to-[#3a3a3c]",
};

export function MemberCard({ name, no, plan, className = "" }: { name: string; no: string; plan?: string | null; className?: string }) {
  const { d, pick } = useApp();
  const ref = useRef<HTMLDivElement>(null);
  const move = (e: React.PointerEvent) => {
    const el = ref.current!, r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
    el.classList.add("live");
    el.style.setProperty("--ry", `${(px - 0.5) * 22}deg`);
    el.style.setProperty("--rx", `${(0.5 - py) * 18}deg`);
    el.style.setProperty("--mx", `${px * 100}%`);
    el.style.setProperty("--my", `${py * 100}%`);
  };
  const leave = () => {
    const el = ref.current!;
    el.classList.remove("live");
    ["--rx", "--ry"].forEach((p) => el.style.setProperty(p, "0deg"));
  };
  const planName = plan ? pick({ plus: { fa: "پلاس", en: "PLUS" }, standard: { fa: "استاندارد", en: "STANDARD" }, fleet: { fa: "ناوگان", en: "FLEET" } }[plan] ?? { fa: "", en: "" }) : d.dash.noPlan;
  return (
    <div className={`float ${className}`}>
      <div ref={ref} onPointerMove={move} onPointerLeave={leave}
        className={`card3d relative aspect-[1.586] w-full overflow-hidden rounded-[22px] bg-gradient-to-br ${CARD_SKINS[plan ?? "none"] ?? CARD_SKINS.none} p-5 text-white shadow-2xl shadow-black/40 ring-1 ring-white/15 sm:p-6`}>
        <div className="absolute -end-16 -top-16 size-56 rounded-full bg-[#bf5af2]/40 blur-3xl" />
        <div className="absolute -bottom-20 -start-10 size-56 rounded-full bg-[#0a84ff]/35 blur-3xl" />
        <div className="holo" />
        <div className="relative flex h-full flex-col justify-between" style={{ transform: "translateZ(40px)" }}>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <Logo className="size-8" />
              <div className="leading-tight">
                <div className="text-[15px] font-bold">{d.brand}</div>
                <div className="text-[11px] text-white/60">{d.brandSub}</div>
              </div>
            </div>
            <span className="rounded-full bg-white/15 px-3 py-1 text-[11px] font-bold tracking-wider backdrop-blur">{planName}</span>
          </div>
          <div className="h-8 w-11 rounded-md bg-gradient-to-br from-[#f5d77b] via-[#d4a843] to-[#f7e3a3] opacity-90 ring-1 ring-black/10" />
          <div className="flex items-end justify-between gap-2">
            <div className="min-w-0">
              <div className="text-[10px] uppercase text-white/50">{d.dash.member}</div>
              <div className="truncate text-base font-semibold sm:text-lg">{name}</div>
            </div>
            <div dir="ltr" className="font-mono text-[13px] tracking-[0.15em] text-white/80 sm:text-sm">{no}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function Reveal({ children, delay = 0, className = "" }: { children: ReactNode; delay?: number; className?: string }) {
  return (
    <motion.div className={className} initial={{ opacity: 0, y: 28, filter: "blur(6px)" }} whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      viewport={{ once: true, margin: "-60px" }} transition={{ duration: 0.8, delay, ease: [0.2, 0.8, 0.2, 1] }}>
      {children}
    </motion.div>
  );
}

export function Segmented<T extends string>({ options, value, onChange }: { options: [T, string][]; value: T; onChange: (v: T) => void }) {
  const id = useId();
  return (
    <div role="tablist" className="inline-flex rounded-full bg-line p-1">
      {options.map(([v, label]) => (
        <button key={v} role="tab" aria-selected={v === value} onClick={() => onChange(v)}
          className={`relative rounded-full px-4 py-1.5 text-sm font-medium transition ${v === value ? "text-fg" : "text-fg-2"}`}>
          {v === value && <motion.span layoutId={id} className="absolute inset-0 rounded-full bg-card shadow-sm" transition={{ type: "spring", bounce: 0.2, duration: 0.45 }} />}
          <span className="relative whitespace-nowrap">{label}</span>
        </button>
      ))}
    </div>
  );
}

export function Sheet({ open, onClose, children, label }: { open: boolean; onClose: () => void; children: ReactNode; label: string }) {
  const { d } = useApp();
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    addEventListener("keydown", k);
    return () => removeEventListener("keydown", k);
  }, [open, onClose]);
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
          <motion.div role="dialog" aria-modal aria-label={label}
            className="pb-safe relative w-full max-w-md rounded-t-[28px] border border-line bg-card p-6 shadow-2xl sm:rounded-[28px]"
            initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", bounce: 0.15, duration: 0.5 }}>
            <div className="mx-auto -mt-2 mb-4 h-1.5 w-10 rounded-full bg-line sm:hidden" />
            <button onClick={onClose} aria-label={d.sos.close} className="absolute end-4 top-4 grid size-8 place-items-center rounded-full bg-line text-fg-2 hover:text-fg">
              <X className="size-4" />
            </button>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export const DEAL_ICONS: Record<string, LucideIcon> = {
  fuel: Fuel, zap: Zap, "battery-charging": BatteryCharging, "shield-check": ShieldCheck, shield: Shield, droplets: Droplets,
  car: Car, wrench: Wrench, "scan-line": ScanLine, "circle-dot": CircleDot, "plug-zap": PlugZap, sparkles: Sparkles,
};

export type Plan = { id: string; name: L10n; monthly: number; yearly: number; features: L10n[]; popular?: boolean; per_vehicle?: boolean };

export function Plans({ current, onChoose }: { current?: string | null; onChoose: (plan: string, period: "monthly" | "yearly") => void }) {
  const { d, pick, num, lang } = useApp();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [period, setPeriod] = useState<"monthly" | "yearly">("yearly");
  useEffect(() => { api<Plan[]>("/plans").then(setPlans).catch(() => {}); }, []);
  return (
    <div>
      <div className="mb-10 flex flex-wrap items-center justify-center gap-3">
        <Segmented options={[["monthly", d.plans.monthly], ["yearly", d.plans.yearly]]} value={period} onChange={setPeriod} />
        <span className="rounded-full bg-green/15 px-3 py-1 text-xs font-semibold text-green">{d.plans.save}</span>
      </div>
      <div className="grid gap-5 md:grid-cols-3">
        {plans.map((p, i) => (
          <Reveal key={p.id} delay={i * 0.08}>
            <div className={`relative flex h-full flex-col rounded-[28px] p-7 transition duration-500 hover:-translate-y-1 ${p.popular ? "bg-fg text-bg shadow-2xl" : "surface"}`}>
              {p.popular && <span className="absolute -top-3 start-7 rounded-full bg-gradient-to-r from-accent-2 to-pink px-3 py-1 text-xs font-bold text-white">{d.plans.popular}</span>}
              <h3 className="text-xl font-bold">{pick(p.name)}</h3>
              <div className="mt-4 flex items-baseline gap-1.5">
                <AnimatePresence mode="popLayout" initial={false}>
                  <motion.span key={period} initial={{ y: 12, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -12, opacity: 0 }}
                    className="tight text-4xl font-extrabold">{num(p[period] / 1000)}</motion.span>
                </AnimatePresence>
                <span className="text-sm opacity-60">{lang === "fa" ? "هزار تومان" : "K Toman"} {period === "monthly" ? d.plans.perMonth : d.plans.perYear}</span>
              </div>
              {p.per_vehicle && <div className="mt-1 text-xs opacity-60">{d.plans.perVehicle}</div>}
              <ul className="my-6 space-y-3 text-sm">
                {p.features.map((f) => (
                  <li key={f.en} className="flex items-center gap-2.5">
                    <span className={`grid size-5 shrink-0 place-items-center rounded-full ${p.popular ? "bg-bg/15" : "bg-accent/12 text-accent"}`}>
                      <svg viewBox="0 0 12 12" className="size-3"><path d="M2.5 6.5 5 9l4.5-6" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
                    </span>
                    {pick(f)}
                  </li>
                ))}
              </ul>
              <button onClick={() => onChoose(p.id, period)} disabled={current === p.id}
                className={`mt-auto h-12 rounded-full font-semibold transition active:scale-[.97] disabled:opacity-50 ${p.popular ? "bg-bg text-fg hover:opacity-90" : "bg-accent text-white hover:brightness-110"}`}>
                {current === p.id ? d.plans.current : d.plans.choose}
              </button>
            </div>
          </Reveal>
        ))}
      </div>
    </div>
  );
}
