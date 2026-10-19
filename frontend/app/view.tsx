"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { animate, useInView } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, BellRing, ChartPie, LifeBuoy, Tag, Users, Wallet } from "lucide-react";
import { DEAL_ICONS, MemberCard, Plans, Reveal, useApp, type Period, type Plan } from "@/components/ui";
import { CarCard, type CarT } from "@/components/car";

type Deal = { id: number; partner: { fa: string; en: string }; icon: string; color: string };
export type Stats = { members: number; partners: number; saved: number; nps: number };

// Writes straight to the text node: one DOM write per frame, no React re-render per frame.
function CountUp({ to, format }: { to: number; format: (n: number) => string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  useEffect(() => {
    const el = ref.current;
    if (!inView || !el) return;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) { el.textContent = format(to); return; }
    const c = animate(0, to, { duration: 1.6, ease: [0.2, 0.8, 0.2, 1], onUpdate: (v) => { el.textContent = format(Math.round(v)); } });
    return () => c.stop();
  }, [inView, to, format]);
  return <span ref={ref}>{format(0)}</span>;
}

const Arrow = ({ className = "" }) => <ArrowLeft className={`size-4 ltr:rotate-180 ${className}`} />;

export default function Landing({ stats, deals, cars, plans }: { stats: Stats | null; deals: Deal[]; cars: CarT[]; plans: Plan[] }) {
  const { d, pick, num, compact, authed, lang } = useApp();
  const router = useRouter();
  const [calc, setCalc] = useState({ fuel: 3_000_000, service: 3, insurance: 18_000_000, wash: 2 });

  const yearly = calc.fuel * 12 * 0.07 + calc.service * 3_500_000 * 0.15 + calc.insurance * 0.12 + calc.wash * 12 * 400_000 * 0.3;
  const plus = plans.find((p) => p.id === "plus")?.yearly ?? 0;
  const months = yearly > 0 && plus ? Math.max(1, Math.ceil(plus / (yearly / 12))) : 0;
  const partners = [...new Map(deals.map((x) => [x.partner.en, x])).values()];
  const year = new Intl.DateTimeFormat(lang === "fa" ? "fa-IR" : "en-US", { year: "numeric" }).format(new Date());
  const choose = (plan: Plan, period: Period) => {
    const next = `/dashboard?plan=${plan.id}&period=${period}`;
    router.push(authed ? next : `/login?next=${encodeURIComponent(next)}`);
  };

  const bento = [
    { k: d.why.deals, Icon: Tag, cls: "md:col-span-2 md:row-span-2", tint: "from-[#0a84ff] to-[#5e5ce6]", big: true },
    { k: d.why.community, Icon: Users, cls: "", tint: "from-[#30d158] to-[#0a9f6b]" },
    { k: d.why.price, Icon: Wallet, cls: "", tint: "from-[#bf5af2] to-[#ff375f]" },
    { k: d.why.assist, Icon: LifeBuoy, cls: "", tint: "from-[#ff375f] to-[#ff9f0a]" },
    { k: d.why.reminder, Icon: BellRing, cls: "", tint: "from-[#ff9f0a] to-[#ffd60a]" },
    { k: d.why.ledger, Icon: ChartPie, cls: "md:col-span-4", tint: "from-[#64d2ff] to-[#0a84ff]" },
  ];

  const sliders = [
    ["fuel", d.calc.fuel, 500_000, 10_000_000, 100_000, true],
    ["service", d.calc.service, 0, 8, 1, false],
    ["insurance", d.calc.insurance, 0, 60_000_000, 1_000_000, true],
    ["wash", d.calc.wash, 0, 8, 1, false],
  ] as const;

  return (
    <>
      {/* HERO */}
      <section className="grain relative isolate overflow-hidden pt-28 md:pt-36">
        <div className="aurora" />
        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-bg to-transparent" />
        <div className="relative mx-auto grid max-w-6xl items-center gap-14 px-5 pb-20 md:grid-cols-[1.1fr_1fr] md:pb-32">
          <div>
            <span
              className="rise glass inline-flex items-center gap-2 rounded-full border border-line px-3.5 py-1.5 text-[13px] font-medium">
              <span className="relative flex size-2"><span className="pulse-ring absolute inset-0 rounded-full bg-green" /><span className="relative size-2 rounded-full bg-green" /></span>
              {d.hero.eyebrow}
            </span>
            <h1 className="tight mt-6 text-[2.6rem] font-black leading-[1.1] sm:text-6xl lg:text-7xl rtl:leading-[1.35]">
              {[d.hero.title1, d.hero.title2].map((line, i) => (
                <span key={line} className={`rise block ${i ? "grad-text pb-2" : ""}`} style={{ animationDelay: `${0.1 + i * 0.15}s` }}>{line}</span>
              ))}
            </h1>
            <p className="rise mt-6 max-w-xl text-lg leading-8 text-fg-2" style={{ animationDelay: ".45s" }}>{d.hero.sub}</p>
            <div className="rise mt-9 flex flex-wrap gap-3" style={{ animationDelay: ".6s" }}>
              <a href="#plans" className="group flex h-12 items-center gap-2 rounded-full bg-accent px-7 text-[15px] font-semibold text-white shadow-lg shadow-accent/30 transition hover:brightness-110 active:scale-95">
                {d.hero.cta}<Arrow className="transition group-hover:-translate-x-1 ltr:group-hover:translate-x-1" />
              </a>
              <Link href="/deals" className="glass flex h-12 items-center rounded-full border border-line px-7 text-[15px] font-semibold transition hover:bg-line active:scale-95">{d.hero.cta2}</Link>
            </div>
          </div>
          <div className="pop relative mx-auto w-full max-w-md" style={{ animationDelay: ".3s" }}>
            <div className="absolute -inset-10 -z-10 bg-[radial-gradient(closest-side,var(--accent-2),transparent)] opacity-50" />
            <MemberCard name={pick({ fa: "آرش رضایی", en: "Arash Rezaei" })} no="HR-1402 0417" plan="plus" />
          </div>
        </div>
      </section>

      {/* STATS */}
      {stats && <section className="mx-auto -mt-6 grid max-w-6xl grid-cols-2 gap-3 px-5 md:grid-cols-4">
        {([["members", num], ["partners", num], ["saved", compact], ["nps", num]] as const).map(([k, f], i) => (
          <Reveal key={k} delay={i * 0.06} className="surface rounded-3xl p-5 text-center">
            <div className="tight text-3xl font-extrabold md:text-4xl">{k === "nps" && "+"}<CountUp to={stats[k]} format={f} /></div>
            <div className="mt-1 text-[13px] text-fg-2">{d.stats[k]}</div>
          </Reveal>
        ))}
      </section>}

      {/* PARTNER MARQUEE */}
      <section className="marquee mt-16 overflow-hidden py-2" aria-hidden>
        <div className="flex gap-3">
          {[...partners, ...partners, ...partners, ...partners].map((p, i) => {
            const Icon = DEAL_ICONS[p.icon];
            return (
              <span key={i} className="surface flex shrink-0 items-center gap-2 rounded-full py-2 pe-5 ps-2 text-sm font-semibold">
                <span className="grid size-8 place-items-center rounded-full text-white" style={{ background: p.color }}>{Icon && <Icon className="size-4" />}</span>
                {pick(p.partner)}
              </span>
            );
          })}
        </div>
      </section>

      {/* BENTO */}
      <section className="mx-auto max-w-6xl px-5 py-24">
        <Reveal className="mb-12 text-center">
          <h2 className="tight text-4xl font-black md:text-5xl">{d.why.title}</h2>
          <p className="mt-4 text-lg text-fg-2">{d.why.sub}</p>
        </Reveal>
        <div className="grid auto-rows-[minmax(190px,auto)] gap-4 md:grid-cols-4">
          {bento.map(({ k, Icon, cls, tint, big }, i) => (
            <Reveal key={k[0]} delay={i * 0.05} className={cls}>
              <div className={`surface group relative h-full overflow-hidden rounded-[28px] p-7 transition duration-500 hover:-translate-y-1 ${big ? "flex flex-col justify-end" : ""}`}>
                <div className={`absolute -end-16 -top-16 size-56 rounded-full bg-gradient-to-br ${tint} opacity-15 transition duration-700 [mask-image:radial-gradient(closest-side,#000,transparent)] group-hover:scale-125 group-hover:opacity-30`} />
                <span className={`relative grid place-items-center rounded-2xl bg-gradient-to-br ${tint} text-white shadow-lg ${big ? "mb-auto size-16" : "size-12"}`}>
                  <Icon className={big ? "size-8" : "size-6"} />
                </span>
                <h3 className={`relative mt-5 font-bold ${big ? "tight text-3xl md:text-4xl" : "text-lg"}`}>{k[0]}</h3>
                <p className={`relative mt-2 text-fg-2 ${big ? "max-w-md text-lg" : "text-sm leading-6"}`}>{k[1]}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* CALCULATOR */}
      <section className="mx-auto max-w-6xl px-5">
        <Reveal>
          <div className="relative overflow-hidden rounded-[28px] bg-[#0b0b10] p-7 text-white md:p-12">
            <div className="aurora opacity-60" />
            <div className="relative grid gap-10 md:grid-cols-2">
              <div>
                <h2 className="tight text-3xl font-black md:text-4xl">{d.calc.title}</h2>
                <p className="mt-3 text-white/70">{d.calc.sub}</p>
                <div className="mt-8 space-y-6">
                  {sliders.map(([k, label, min, max, step, money]) => (
                    <label key={k} className="block">
                      <div className="mb-2 flex justify-between text-sm"><span className="text-white/70">{label}</span>
                        <span className="font-semibold">{money ? `${compact(calc[k])} ${d.toman}` : num(calc[k])}</span></div>
                      <input type="range" min={min} max={max} step={step} value={calc[k]} className="w-full"
                        onChange={(e) => setCalc({ ...calc, [k]: +e.target.value })} />
                    </label>
                  ))}
                </div>
              </div>
              <div className="flex flex-col justify-center rounded-[22px] bg-white/8 p-8 ring-1 ring-white/10">
                <div className="text-sm text-white/70">{d.calc.yearly}</div>
                <div className="tight mt-2 text-5xl font-black md:text-6xl">
                  <span className="bg-gradient-to-r from-[#64d2ff] via-[#bf5af2] to-[#ff375f] bg-clip-text text-transparent">{num(Math.round(yearly / 1000) * 1000)}</span>
                </div>
                <div className="mt-1 text-white/60">{d.toman}</div>
                <div className="my-7 h-px bg-white/10" />
                <div className="flex items-center justify-between text-sm"><span className="text-white/70">{d.calc.net}</span>
                  <span dir="ltr" className={`font-bold ${yearly - plus > 0 ? "text-[#30d158]" : "text-[#ff453a]"}`}>{num(Math.round((yearly - plus) / 1000) * 1000)}</span></div>
                {months > 0 && <div className="mt-5 rounded-2xl bg-[#30d158]/15 px-4 py-3 text-sm font-semibold text-[#30d158]">{d.calc.payback(num(months))}</div>}
              </div>
            </div>
          </div>
        </Reveal>
      </section>

      {/* PLANS */}
      <section id="plans" className="mx-auto max-w-6xl scroll-mt-24 px-5 py-24">
        <Reveal className="mb-8 text-center"><h2 className="tight text-4xl font-black md:text-5xl">{d.plans.title}</h2></Reveal>
        <Plans plans={plans} onChoose={choose} />
      </section>

      {/* MARKET TEASER */}
      <section className="mx-auto max-w-6xl px-5 pb-24">
        <Reveal className="mb-10 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="tight text-4xl font-black md:text-5xl">{d.market.teaser}</h2>
            <p className="mt-3 text-lg text-fg-2">{d.market.sub}</p>
          </div>
          <Link href="/market" className="group flex items-center gap-1.5 font-semibold text-accent">{d.market.seeAll}<Arrow /></Link>
        </Reveal>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {cars.map((c, i) => <Reveal key={c.id} delay={i * 0.08}><CarCard car={c} /></Reveal>)}
        </div>
      </section>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-8 text-sm text-fg-2">
          <span><b className="text-fg">{d.brand}</b> · {d.footer.tag}</span>
          <span>© {year} · {d.footer.rights}</span>
        </div>
      </footer>
    </>
  );
}
