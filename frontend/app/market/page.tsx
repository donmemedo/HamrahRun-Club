"use client";
import { motion } from "motion/react";
import { useEffect, useState } from "react";
import { Segmented, useApp } from "@/components/ui";
import { CarCard, type CarT } from "@/components/car";
import { api } from "@/lib/api";

export default function Market() {
  const { d } = useApp();
  const [cars, setCars] = useState<CarT[]>([]);
  const [max, setMax] = useState<"all" | "1" | "2">("all");
  useEffect(() => { api<CarT[]>("/cars").then(setCars).catch(() => {}); }, []);
  const list = cars.filter((c) => max === "all" || c.price <= +max * 1e9);
  return (
    <div className="mx-auto max-w-6xl px-5 pb-16 pt-28 md:pt-32">
      <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="tight text-5xl font-black md:text-6xl">{d.market.title}</motion.h1>
      <p className="mt-3 text-lg text-fg-2">{d.market.sub}</p>
      <div className="mt-8"><Segmented options={[["all", d.market.all], ["1", d.market.under1], ["2", d.market.under2]]} value={max} onChange={setMax} /></div>
      <motion.div layout className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {list.map((c) => (
          <motion.div layout key={c.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ type: "spring", bounce: 0.2 }}>
            <CarCard car={c} />
          </motion.div>
        ))}
      </motion.div>
    </div>
  );
}
