"use client";
import { motion } from "motion/react";
import { useState } from "react";
import { LoadError, Segmented, useApp } from "@/components/ui";
import { CarCard, type CarT } from "@/components/car";

export default function Market({ cars }: { cars: CarT[] | null }) {
  const { d } = useApp();
  const [max, setMax] = useState<"all" | "1" | "2">("all");
  const list = (cars ?? []).filter((c) => max === "all" || c.price <= +max * 1e9);
  return (
    <div className="mx-auto max-w-6xl px-5 pb-16 pt-28 md:pt-32">
      <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="tight text-5xl font-black md:text-6xl">{d.market.title}</motion.h1>
      <p className="mt-3 text-lg text-fg-2">{d.market.sub}</p>
      <div className="mt-8"><Segmented label={d.market.title} options={[["all", d.market.all], ["1", d.market.under1], ["2", d.market.under2]]} value={max} onChange={setMax} /></div>
      {!cars && <LoadError />}
      <motion.div layout className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {list.map((c) => (
          <motion.div layout key={c.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <CarCard car={c} />
          </motion.div>
        ))}
      </motion.div>
    </div>
  );
}
