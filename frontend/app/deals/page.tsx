"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import { Check, Copy, Search, Star } from "lucide-react";
import { DEAL_ICONS, Sheet, useApp } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import type { L10n } from "@/lib/i18n";

type Deal = { id: number; partner: L10n; category: string; title: L10n; discount: number; saving: number; icon: string; color: string; rating: number };
const CATS = ["fuel", "charge", "battery", "insurance", "wash", "rental", "repair", "tire"];

export default function Deals() {
  const { d, pick, num, compact, token } = useApp();
  const router = useRouter();
  const [all, setAll] = useState<Deal[]>([]);
  const [cat, setCat] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [result, setResult] = useState<{ deal: Deal; code?: string; needPlan?: boolean } | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => { api<Deal[]>("/deals").then(setAll).catch(() => {}); }, []);
  const needle = q.trim().toLowerCase();
  const list = all.filter((x) => (!cat || x.category === cat) &&
    (!needle || `${x.title.fa} ${x.title.en} ${x.partner.fa} ${x.partner.en}`.toLowerCase().includes(needle)));

  const redeem = async (deal: Deal) => {
    if (!token) return router.push(`/login?next=/deals`);
    try {
      const r = await api<{ code: string }>(`/deals/${deal.id}/redeem`, {});
      setCopied(false);
      setResult({ deal, code: r.code });
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) return router.push(`/login?next=/deals`);
      setResult({ deal, needPlan: e instanceof ApiError && e.status === 402 });
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-5 pt-28 md:pt-32">
      <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="tight text-5xl font-black md:text-6xl">{d.deals.title}</motion.h1>
      <p className="mt-3 text-lg text-fg-2">{d.deals.sub}</p>

      <div className="sticky top-[76px] z-30 -mx-5 mt-8 space-y-3 bg-bg/80 px-5 py-3 backdrop-blur-xl md:top-[84px]">
        <label className="surface flex h-12 items-center gap-2 rounded-2xl px-4 focus-within:ring-2 focus-within:ring-accent">
          <Search className="size-5 text-fg-2" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={d.deals.search} type="search"
            className="h-full w-full bg-transparent outline-none placeholder:text-fg-2" />
        </label>
        <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5">
          {[null, ...CATS].map((c) => (
            <button key={c ?? "all"} onClick={() => setCat(c)}
              className={`h-9 shrink-0 rounded-full px-4 text-sm font-medium transition active:scale-95 ${cat === c ? "bg-fg text-bg" : "surface text-fg-2 hover:text-fg"}`}>
              {c ? d.deals.cats[c] : d.deals.all}
            </button>
          ))}
        </div>
      </div>

      <motion.div layout className="mt-4 grid gap-4 pb-16 sm:grid-cols-2 lg:grid-cols-3">
        <AnimatePresence mode="popLayout">
          {list.map((x) => {
            const Icon = DEAL_ICONS[x.icon];
            return (
              <motion.article layout key={x.id} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                transition={{ type: "spring", bounce: 0.2, duration: 0.5 }}
                className="surface group relative flex flex-col overflow-hidden rounded-[28px] p-6">
                <div className="absolute -end-12 -top-12 size-40 rounded-full opacity-20 blur-2xl transition duration-700 group-hover:scale-150" style={{ background: x.color }} />
                <div className="relative flex items-start justify-between">
                  <span className="grid size-14 place-items-center rounded-2xl text-white shadow-lg" style={{ background: `linear-gradient(135deg, ${x.color}, ${x.color}aa)` }}>
                    {Icon && <Icon className="size-7" />}
                  </span>
                  <span className="tight text-3xl font-black" style={{ color: x.color }}>{x.discount === 100 ? d.deals.free : pick({ fa: `٪${num(x.discount)}`, en: `${x.discount}%` })}</span>
                </div>
                <div className="relative mt-5 flex items-center gap-1.5 text-[13px] text-fg-2">
                  {pick(x.partner)} · <Star className="size-3.5 fill-[#ff9f0a] text-[#ff9f0a]" />{num(x.rating)}
                </div>
                <h3 className="relative mt-1 text-lg font-bold">{pick(x.title)}</h3>
                <p className="relative mt-1 text-sm text-fg-2">{d.deals.save} {compact(x.saving)} {d.toman}</p>
                <button onClick={() => redeem(x)} className="relative mt-5 h-11 rounded-full bg-fg text-sm font-semibold text-bg transition hover:opacity-85 active:scale-[.97]">{d.deals.get}</button>
              </motion.article>
            );
          })}
        </AnimatePresence>
        {!list.length && all.length > 0 && <p className="col-span-full py-20 text-center text-fg-2">{d.deals.empty}</p>}
      </motion.div>

      <Sheet open={!!result} onClose={() => setResult(null)} label={d.deals.codeTitle}>
        {result?.code ? (
          <div className="text-center">
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", bounce: 0.5 }}
              className="mx-auto grid size-16 place-items-center rounded-full bg-green text-white"><Check className="size-8" strokeWidth={3} /></motion.div>
            <h2 className="mt-4 text-xl font-bold">{d.deals.codeTitle}</h2>
            <p className="mt-1 text-sm text-fg-2">{pick(result.deal.title)}</p>
            <div dir="ltr" className="mt-6 rounded-2xl border-2 border-dashed border-line bg-card-2 py-5 font-mono text-3xl font-bold tracking-[0.2em]">{result.code}</div>
            <p className="mt-3 text-sm text-fg-2">{d.deals.codeHint}</p>
            <button onClick={() => { navigator.clipboard?.writeText(result.code!); setCopied(true); }}
              className="mt-6 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-accent font-semibold text-white active:scale-[.98]">
              {copied ? <Check className="size-5" /> : <Copy className="size-5" />}{copied ? d.deals.copied : d.deals.copy}
            </button>
          </div>
        ) : (
          <div className="pt-2 text-center">
            <p className="text-lg font-semibold">{result?.needPlan ? d.deals.needPlan : d.error}</p>
            {result?.needPlan && <Link href="/#plans" className="mt-6 flex h-12 items-center justify-center rounded-full bg-accent font-semibold text-white">{d.hero.cta}</Link>}
          </div>
        )}
      </Sheet>
    </div>
  );
}
