"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence, MotionConfig, motion, useDragControls, useMotionValue, useTransform } from "motion/react";
import { createContext, useContext, useEffect, useId, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import {
  BatteryCharging, Car, CircleDot, Droplets, Fuel, Home, Languages, LifeBuoy, Moon, PlugZap, ScanLine,
  Shield, ShieldCheck, ShoppingBag, Sparkles, Sun, Tag, User, Wrench, X, Zap, type LucideIcon,
} from "lucide-react";
import { dicts, type Dict, type L10n, type Lang } from "@/lib/i18n";
import { ApiError } from "@/lib/api";

// Motion tokens (Apple "Designing Fluid Interfaces"): critically damped by default; bounce only after a momentum gesture.
export const SPRING = { type: "spring", bounce: 0, duration: 0.4 } as const;
export const SPRING_DRAWER = { type: "spring", bounce: 0.2, duration: 0.3 } as const; // damping ~0.8, response 0.3
const project = (v: number, rate = 0.998) => ((v / 1000) * rate) / (1 - rate); // where a flick comes to rest

type Ctx = {
  lang: Lang; d: Dict; setLang: (l: Lang) => void; pick: (v: L10n) => string;
  num: (n: number) => string; compact: (n: number) => string;
  authed: boolean; setAuthed: (v: boolean) => void; err: (e: unknown) => string;
};
const AppCtx = createContext<Ctx>(null!);
export const useApp = () => useContext(AppCtx);

const setCookie = (k: string, v: string) => { document.cookie = `${k}=${v}; path=/; max-age=31536000; samesite=lax`; };

export function useMedia(query: string) {
  return useSyncExternalStore(
    (cb) => { const m = matchMedia(query); m.addEventListener("change", cb); return () => m.removeEventListener("change", cb); },
    () => matchMedia(query).matches,
    () => false,
  );
}

export function Providers({ lang: initial, authed: initialAuthed, children }: { lang: Lang; authed: boolean; children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(initial);
  const [authed, setAuthed] = useState(initialAuthed);
  const value = useMemo<Ctx>(() => {
    const loc = lang === "fa" ? "fa-IR" : "en-US";
    const nf = new Intl.NumberFormat(loc), cf = new Intl.NumberFormat(loc, { notation: "compact", maximumFractionDigits: 1 });
    const d = dicts[lang];
    return {
      lang, d, authed, setAuthed,
      setLang: (l) => {
        setCookie("lang", l);
        document.documentElement.lang = l;
        document.documentElement.dir = l === "fa" ? "rtl" : "ltr";
        setLangState(l);
      },
      pick: (v) => v[lang],
      num: (n) => nf.format(n),
      compact: (n) => cf.format(n),
      err: (e) => (e instanceof ApiError && d.errors[e.message]) || d.error,
    };
  }, [lang, authed]);
  return (
    <AppCtx.Provider value={value}>
      <MotionConfig reducedMotion="user" transition={SPRING}>{children}</MotionConfig>
    </AppCtx.Provider>
  );
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
      className="grid size-11 place-items-center rounded-full text-fg-2 transition hover:bg-line hover:text-fg active:scale-90">
      <AnimatePresence mode="wait" initial={false}>
        <motion.span key={String(dark)} initial={{ rotate: -90, scale: 0.5, opacity: 0 }} animate={{ rotate: 0, scale: 1, opacity: 1 }}
          exit={{ rotate: 90, scale: 0.5, opacity: 0 }} transition={{ ...SPRING, duration: 0.25 }}>
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
      className="flex h-11 items-center gap-1 rounded-full px-3 text-[13px] font-semibold text-fg-2 transition hover:bg-line hover:text-fg active:scale-95">
      <Languages className="size-4" />{lang === "fa" ? "EN" : "فا"}
    </button>
  );
}

export function Nav() {
  const { d, authed } = useApp();
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
              <Link key={href} href={href} aria-current={active ? "page" : undefined}
                className={`relative rounded-full px-4 py-2.5 text-sm transition ${active ? "text-fg" : "text-fg-2 hover:text-fg"}`}>
                {active && <motion.span layoutId="nav-pill" className="absolute inset-0 rounded-full bg-line" />}
                <span className="relative">{label}</span>
              </Link>
            );
          })}
        </div>
        <div className="ms-auto flex items-center gap-0.5 md:ms-0">
          <LangToggle />
          <ThemeToggle />
          <Link href={authed ? "/dashboard" : "/login"}
            className="ms-1 hidden h-11 items-center rounded-full bg-fg px-5 text-sm font-semibold text-bg transition hover:opacity-85 active:scale-95 sm:flex">
            {authed ? d.nav.dashboard : d.nav.login}
          </Link>
        </div>
      </nav>
    </header>
  );
}

export function TabBar() {
  const { d, authed } = useApp();
  const path = usePathname();
  const tabs: [string, string, LucideIcon][] = [
    ["/", d.nav.home, Home], ["/deals", d.nav.deals, Tag], ["/dashboard?sos=1", d.nav.sos, LifeBuoy],
    ["/market", d.nav.market, ShoppingBag], [authed ? "/dashboard" : "/login", d.nav.account, User],
  ];
  return (
    <nav className="glass pb-safe fixed inset-x-0 bottom-0 z-50 border-t border-line md:hidden">
      <div className="mx-auto flex max-w-md items-end justify-around px-2 pt-1.5">
        {tabs.map(([href, label, Icon], i) => {
          if (i === 2) return (
            <Link key={href} href={href} aria-label={label} className="-mt-6 flex flex-col items-center gap-1 text-[10px] font-medium text-fg-2">
              <span className="grid size-14 place-items-center rounded-full bg-gradient-to-br from-[#ff375f] to-[#ff9f0a] text-white shadow-lg shadow-pink/40 transition active:scale-90">
                <Icon className="size-6" />
              </span>
              {label}
            </Link>
          );
          const active = path === href.split("?")[0];
          return (
            <Link key={href} href={href} aria-current={active ? "page" : undefined}
              className={`flex min-h-11 w-16 flex-col items-center gap-1 py-1 text-[10px] font-medium transition active:scale-90 ${active ? "text-accent" : "text-fg-2"}`}>
              <Icon className="size-6" strokeWidth={active ? 2.2 : 1.8} />
              {label}
            </Link>
          );
        })}
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
const PLAN_NAMES: Record<string, L10n> = { plus: { fa: "پلاس", en: "PLUS" }, standard: { fa: "استاندارد", en: "STANDARD" }, fleet: { fa: "ناوگان", en: "FLEET" } };

export function MemberCard({ name, no, plan, className = "" }: { name: string; no: string; plan?: string | null; className?: string }) {
  const { d, pick } = useApp();
  const ref = useRef<HTMLDivElement>(null);
  const rect = useRef<DOMRect | null>(null);
  const frame = useRef(0);
  // Mouse-only tilt: rect read once on enter, style writes batched to one per frame. Touch scrolls through untouched.
  const enter = (e: React.PointerEvent) => {
    if (e.pointerType !== "mouse" || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    rect.current = ref.current!.getBoundingClientRect();
    ref.current!.classList.add("live");
  };
  const move = (e: React.PointerEvent) => {
    const r = rect.current;
    if (!r) return;
    const px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      const s = ref.current!.style;
      s.setProperty("--ry", `${(px - 0.5) * 22}deg`);
      s.setProperty("--rx", `${(0.5 - py) * 18}deg`);
      s.setProperty("--mx", `${px * 100}%`);
      s.setProperty("--my", `${py * 100}%`);
    });
  };
  const leave = () => {
    cancelAnimationFrame(frame.current);
    rect.current = null;
    const el = ref.current!;
    el.classList.remove("live");
    ["--rx", "--ry"].forEach((p) => el.style.setProperty(p, "0deg"));
  };
  const planName = plan ? pick(PLAN_NAMES[plan] ?? { fa: "", en: "" }) : d.dash.noPlan;
  return (
    <div ref={ref} onPointerEnter={enter} onPointerMove={move} onPointerLeave={leave}
      className={`card3d relative aspect-[1.586] w-full overflow-hidden rounded-[22px] bg-gradient-to-br ${CARD_SKINS[plan ?? "none"] ?? CARD_SKINS.none} p-5 text-white shadow-2xl shadow-black/40 ring-1 ring-white/15 sm:p-6 ${className}`}>
      <div className="card-glow absolute inset-0" />
      <div className="holo" />
      <div className="relative flex h-full flex-col justify-between" style={{ transform: "translateZ(40px)" }}>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <Logo className="size-8" />
            <div className="leading-tight">
              <div className="text-[15px] font-bold">{d.brand}</div>
              <div className="text-[11px] text-white/70">{d.brandSub}</div>
            </div>
          </div>
          <span className="rounded-full bg-white/15 px-3 py-1 text-[11px] font-bold ltr:tracking-wider">{planName}</span>
        </div>
        <div className="h-8 w-11 rounded-md bg-gradient-to-br from-[#f5d77b] via-[#d4a843] to-[#f7e3a3] opacity-90 ring-1 ring-black/10" />
        <div className="flex items-end justify-between gap-2">
          <div className="min-w-0">
            <div className="text-[10px] uppercase text-white/60">{d.dash.member}</div>
            <div className="truncate text-base font-semibold sm:text-lg">{name}</div>
          </div>
          <div dir="ltr" className="font-mono text-[13px] tracking-[0.15em] text-white/80 sm:text-sm">{no}</div>
        </div>
      </div>
    </div>
  );
}

/** Scroll-in entrance: opacity + transform only, so it stays on the compositor. */
export function Reveal({ children, delay = 0, className = "" }: { children: ReactNode; delay?: number; className?: string }) {
  return (
    <motion.div className={className} initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }} transition={{ ...SPRING, delay }}>
      {children}
    </motion.div>
  );
}

/** A single-choice control: radiogroup semantics, roving tabindex, arrow keys that respect RTL. */
export function Segmented<T extends string>({ options, value, onChange, label }: { options: [T, string][]; value: T; onChange: (v: T) => void; label: string }) {
  const id = useId();
  const key = (e: React.KeyboardEvent<HTMLButtonElement>, i: number) => {
    const rtl = document.documentElement.dir === "rtl";
    const step = { ArrowDown: 1, ArrowUp: -1, ArrowRight: rtl ? -1 : 1, ArrowLeft: rtl ? 1 : -1 }[e.key];
    if (!step) return;
    e.preventDefault();
    const j = (i + step + options.length) % options.length;
    onChange(options[j][0]);
    (e.currentTarget.parentElement!.children[j] as HTMLElement).focus();
  };
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-full bg-line p-1">
      {options.map(([v, text], i) => (
        <button key={v} type="button" role="radio" aria-checked={v === value} tabIndex={v === value ? 0 : -1}
          onClick={() => onChange(v)} onKeyDown={(e) => key(e, i)}
          className={`relative min-h-9 rounded-full px-4 text-sm font-medium transition ${v === value ? "text-fg" : "text-fg-2"}`}>
          {v === value && <motion.span layoutId={id} className="absolute inset-0 rounded-full bg-card shadow-sm" />}
          <span className="relative whitespace-nowrap">{text}</span>
        </button>
      ))}
    </div>
  );
}

const FOCUSABLE = 'button:not([disabled]),[href],input:not([disabled]),textarea:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])';

/**
 * Modal sheet. Phone: a bottom drawer that tracks the finger 1:1, rubber-bands upward, dims with drag progress and
 * dismisses on the projected end point of a flick. Desktop: a centred dialog that scales in and out along the same path.
 * Focus is trapped while open and returned to the trigger on close.
 */
export function Sheet({ open, onClose, children, label }: { open: boolean; onClose: () => void; children: ReactNode; label: string }) {
  const { d } = useApp();
  const wide = useMedia("(min-width: 640px)");
  const panel = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  const drag = useDragControls();
  const y = useMotionValue(0);
  const scrim = useTransform(y, [0, 360], [1, 0]);

  useEffect(() => {
    if (!open) return;
    const back = document.activeElement as HTMLElement | null;
    panel.current?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") return close.current();
      const el = panel.current;
      if (e.key !== "Tab" || !el) return;
      const f = [...el.querySelectorAll<HTMLElement>(FOCUSABLE)];
      if (!f.length) return e.preventDefault();
      const [first, last] = [f[0], f[f.length - 1]];
      if (e.shiftKey && (document.activeElement === first || document.activeElement === el)) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", key);
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", key); document.body.style.overflow = ""; back?.focus?.(); };
  }, [open]);

  const motionProps = wide
    ? { initial: { opacity: 0, scale: 0.96 }, animate: { opacity: 1, scale: 1 }, exit: { opacity: 0, scale: 0.96 }, transition: SPRING }
    : { initial: { y: "100%" }, animate: { y: 0 }, exit: { y: "100%" }, transition: SPRING_DRAWER };

  return (
    <AnimatePresence onExitComplete={() => y.set(0)}>
      {open && (
        <motion.div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center sm:p-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <motion.div className="absolute inset-0 bg-black/40" style={{ opacity: wide ? 1 : scrim }} onClick={onClose} />
          <motion.div ref={panel} role="dialog" aria-modal="true" aria-label={label} tabIndex={-1} {...motionProps}
            style={wide ? undefined : { y }}
            drag={wide ? false : "y"} dragListener={false} dragControls={drag}
            dragConstraints={{ top: 0, bottom: 0 }} dragElastic={{ top: 0.06, bottom: 1 }}
            onPointerDown={(e) => { if (!wide && !(e.target as HTMLElement).closest("input,textarea,select")) drag.start(e); }}
            onDragEnd={(_, info) => {
              if (info.offset.y + project(info.velocity.y) > (panel.current?.offsetHeight ?? 400) / 2) onClose();
            }}
            className="pb-safe relative max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-t-[28px] border border-line bg-card p-6 shadow-2xl outline-none sm:rounded-[28px]">
            <div className="mx-auto -mt-2 mb-4 h-1.5 w-10 rounded-full bg-line sm:hidden" aria-hidden />
            <button onClick={onClose} aria-label={d.sos.close} className="absolute end-2 top-2 grid size-11 place-items-center rounded-full text-fg-2 hover:text-fg">
              <span className="grid size-8 place-items-center rounded-full bg-line"><X className="size-4" /></span>
            </button>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function LoadError() {
  const { d } = useApp();
  const router = useRouter();
  return (
    <div role="alert" className="col-span-full flex flex-col items-center gap-3 py-16 text-center text-fg-2">
      {d.loadError}
      <button onClick={() => router.refresh()} className="h-11 rounded-full bg-fg px-6 text-sm font-semibold text-bg active:scale-95">{d.retry}</button>
    </div>
  );
}

export const DEAL_ICONS: Record<string, LucideIcon> = {
  fuel: Fuel, zap: Zap, "battery-charging": BatteryCharging, "shield-check": ShieldCheck, shield: Shield, droplets: Droplets,
  car: Car, wrench: Wrench, "scan-line": ScanLine, "circle-dot": CircleDot, "plug-zap": PlugZap, sparkles: Sparkles,
};

export type Plan = { id: string; name: L10n; monthly: number; yearly: number; features: L10n[]; popular?: boolean; per_vehicle?: boolean };
export type Period = "monthly" | "yearly";

export function PeriodSwitch({ period, onChange }: { period: Period; onChange: (p: Period) => void }) {
  const { d } = useApp();
  return <Segmented label={d.plans.title} options={[["monthly", d.plans.monthly], ["yearly", d.plans.yearly]]} value={period} onChange={onChange} />;
}

export function Plans({ plans, current, onChoose }: { plans: Plan[]; current?: string | null; onChoose: (plan: Plan, period: Period) => void }) {
  const { d, pick, num, lang } = useApp();
  const [period, setPeriod] = useState<Period>("yearly");
  if (!plans.length) return <LoadError />;
  return (
    <div>
      <div className="mb-10 flex flex-wrap items-center justify-center gap-3">
        <PeriodSwitch period={period} onChange={setPeriod} />
        <span className="rounded-full bg-green/15 px-3 py-1 text-xs font-semibold text-green">{d.plans.save}</span>
      </div>
      <div className="grid gap-5 md:grid-cols-3">
        {plans.map((p, i) => (
          <Reveal key={p.id} delay={i * 0.06}>
            <div className={`relative flex h-full flex-col rounded-[28px] p-7 transition duration-500 hover:-translate-y-1 ${p.popular ? "bg-fg text-bg shadow-2xl" : "surface"}`}>
              {p.popular && <span className="absolute -top-3 start-7 rounded-full bg-gradient-to-r from-accent-2 to-pink px-3 py-1 text-xs font-bold text-white">{d.plans.popular}</span>}
              <h3 className="text-xl font-bold">{pick(p.name)}</h3>
              <div className="mt-4 flex items-baseline gap-1.5">
                <AnimatePresence mode="popLayout" initial={false}>
                  <motion.span key={period} initial={{ y: 12, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -12, opacity: 0 }}
                    className="tight text-4xl font-extrabold">{num(p[period] / 1000)}</motion.span>
                </AnimatePresence>
                <span className="text-sm opacity-70">{lang === "fa" ? "هزار تومان" : "K Toman"} {period === "monthly" ? d.plans.perMonth : d.plans.perYear}</span>
              </div>
              {p.per_vehicle && <div className="mt-1 text-xs opacity-70">{d.plans.perVehicle}</div>}
              <ul className="my-6 space-y-3 text-sm">
                {p.features.map((f) => (
                  <li key={f.en} className="flex items-center gap-2.5">
                    <span className={`grid size-5 shrink-0 place-items-center rounded-full ${p.popular ? "bg-bg/15" : "bg-accent/12 text-accent"}`}>
                      <svg viewBox="0 0 12 12" className="size-3" aria-hidden><path d="M2.5 6.5 5 9l4.5-6" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
                    </span>
                    {pick(f)}
                  </li>
                ))}
              </ul>
              <button onClick={() => onChoose(p, period)} disabled={current === p.id}
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
