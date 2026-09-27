"use client";
import { useState } from "react";
import { BadgeCheck, Check, Gauge, MapPin, Settings2 } from "lucide-react";
import { useApp } from "@/components/ui";
import type { L10n } from "@/lib/i18n";

export type CarT = { id: number; model: L10n; year: number; km: number; price: number; city: L10n; score: number; gearbox: string; color: string };

function CarArt({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 200 84" className="w-full drop-shadow-[0_18px_18px_rgba(0,0,0,.35)]" aria-hidden>
      <ellipse cx="100" cy="76" rx="88" ry="5" fill="black" opacity=".25" />
      <path d="M10 55c0-10 8-13 20-15l30-4c12-12 28-18 50-18 20 0 35 6 48 18l22 4c8 2 12 8 12 15v5c0 3-2 5-5 5H13c-2 0-3-2-3-5Z" fill={color} />
      <path d="M10 55c0-10 8-13 20-15l30-4c12-12 28-18 50-18 20 0 35 6 48 18l22 4c8 2 12 8 12 15" fill="none" stroke="white" strokeOpacity=".35" strokeWidth="1.2" />
      <path d="M68 37c10-10 24-14 40-14v14Zm46-14c16 0 28 5 38 14h-38Z" fill="#0b0b0f" opacity=".75" />
      <path d="M20 50h14" stroke="#ffd60a" strokeWidth="3" strokeLinecap="round" /><path d="M180 50h6" stroke="#ff453a" strokeWidth="3" strokeLinecap="round" />
      {[50, 152].map((x) => (
        <g key={x}><circle cx={x} cy="64" r="13" fill="#111" /><circle cx={x} cy="64" r="6.5" fill="#8e8e93" /><circle cx={x} cy="64" r="2" fill="#111" /></g>
      ))}
    </svg>
  );
}

export function CarCard({ car }: { car: CarT }) {
  const { d, pick, num, lang } = useApp();
  const [requested, setRequested] = useState(false);
  const year = lang === "fa" ? num(car.year).replace(/٬/g, "") : String(car.year + 621);
  return (
    <article className="surface group flex h-full flex-col overflow-hidden rounded-[28px]">
      <div className="relative bg-gradient-to-br from-[#e8ecf5] to-[#cfd6e6] px-8 pb-4 pt-10 dark:from-[#1f2330] dark:to-[#0f1117]">
        <span className="absolute start-4 top-4 flex items-center gap-1 rounded-full bg-green px-2.5 py-1 text-[11px] font-bold text-white">
          <BadgeCheck className="size-3.5" />{d.market.certified}
        </span>
        <div className="transition duration-700 ease-[cubic-bezier(.2,.8,.2,1)] group-hover:-translate-y-1 group-hover:scale-[1.04]"><CarArt color={car.color} /></div>
      </div>
      <div className="flex flex-1 flex-col p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold">{pick(car.model)}</h3>
            <p className="text-sm text-fg-2">{year}</p>
          </div>
          <div className="relative grid size-12 shrink-0 place-items-center" title={d.market.score}>
            <svg viewBox="0 0 36 36" className="absolute inset-0 -rotate-90">
              <circle cx="18" cy="18" r="15.5" fill="none" stroke="var(--line)" strokeWidth="3" />
              <circle cx="18" cy="18" r="15.5" fill="none" stroke="var(--green)" strokeWidth="3" strokeLinecap="round" strokeDasharray={`${car.score * 0.974} 100`} />
            </svg>
            <span className="text-xs font-bold">{num(car.score)}</span>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-fg-2">
          <span className="flex items-center gap-1"><Gauge className="size-3.5" />{num(car.km)} {d.market.km}</span>
          <span className="flex items-center gap-1"><Settings2 className="size-3.5" />{car.gearbox === "auto" ? d.market.auto : d.market.manual}</span>
          <span className="flex items-center gap-1"><MapPin className="size-3.5" />{pick(car.city)}</span>
        </div>
        <div className="mt-auto flex items-center justify-between gap-3 pt-5">
          <div className="text-lg font-extrabold">{num(car.price)} <span className="text-xs font-normal text-fg-2">{d.toman}</span></div>
          <button onClick={() => setRequested(true)} disabled={requested}
            className="flex h-10 items-center gap-1.5 rounded-full bg-accent/12 px-4 text-sm font-semibold text-accent transition hover:bg-accent hover:text-white active:scale-95 disabled:bg-green/15 disabled:text-green">
            {requested && <Check className="size-4" />}{requested ? d.market.requested : d.market.visit}
          </button>
        </div>
      </div>
    </article>
  );
}
