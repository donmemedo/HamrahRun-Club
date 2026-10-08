import type { Metadata } from "next";
import type { CarT } from "@/components/car";
import { dicts } from "@/lib/i18n";
import { getJSON, getLang } from "@/lib/server";
import Market from "./view";

export async function generateMetadata(): Promise<Metadata> {
  const d = dicts[await getLang()];
  return { title: d.market.title, description: d.market.sub };
}

export default async function Page() {
  return <Market cars={await getJSON<CarT[]>("/cars")} />;
}
