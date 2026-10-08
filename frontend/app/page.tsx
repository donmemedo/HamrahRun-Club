import { getJSON } from "@/lib/server";
import type { CarT } from "@/components/car";
import type { Plan } from "@/components/ui";
import Landing, { type Stats } from "./view";

export default async function Page() {
  const [stats, deals, cars, plans] = await Promise.all([
    getJSON<Stats>("/stats", 60), getJSON<Parameters<typeof Landing>[0]["deals"]>("/deals"), getJSON<CarT[]>("/cars"), getJSON<Plan[]>("/plans"),
  ]);
  return <Landing stats={stats} deals={deals ?? []} cars={(cars ?? []).slice(0, 3)} plans={plans ?? []} />;
}
