import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { Plan } from "@/components/ui";
import { dicts } from "@/lib/i18n";
import { getJSON, getLang, getMe } from "@/lib/server";
import Dashboard, { type Me } from "./view";

export async function generateMetadata(): Promise<Metadata> {
  return { title: dicts[await getLang()].nav.dashboard, robots: { index: false } };
}

type Search = Promise<Record<string, string | string[] | undefined>>;

export default async function Page({ searchParams }: { searchParams: Search }) {
  const sp = await searchParams;
  const plan = typeof sp.plan === "string" && ["standard", "plus", "fleet"].includes(sp.plan) ? sp.plan : null;
  const period = sp.period === "monthly" ? "monthly" : "yearly";
  const sos = sp.sos === "1";
  const here = plan ? `/dashboard?plan=${plan}&period=${period}` : sos ? "/dashboard?sos=1" : "/dashboard";
  const login = `/login?next=${encodeURIComponent(here)}`;
  const session = (await cookies()).get("hr_session")?.value;
  if (!session) redirect(login);
  const [me, plans] = await Promise.all([getMe<Me>(session), getJSON<Plan[]>("/plans")]);
  if (me === 401) redirect(login);
  return <Dashboard me={me} plans={plans ?? []} buy={plan ? { plan, period } : null} sos={sos} />;
}
