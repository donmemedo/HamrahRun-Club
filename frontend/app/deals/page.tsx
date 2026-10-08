import type { Metadata } from "next";
import { dicts } from "@/lib/i18n";
import { getJSON, getLang } from "@/lib/server";
import Deals, { type Deal } from "./view";

export async function generateMetadata(): Promise<Metadata> {
  const d = dicts[await getLang()];
  return { title: d.deals.title, description: d.deals.sub };
}

export default async function Page() {
  return <Deals deals={await getJSON<Deal[]>("/deals")} />;
}
