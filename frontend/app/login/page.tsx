import type { Metadata } from "next";
import { Suspense } from "react";
import { dicts } from "@/lib/i18n";
import { getLang } from "@/lib/server";
import LoginForm from "./view";

export async function generateMetadata(): Promise<Metadata> {
  return { title: dicts[await getLang()].auth.title, robots: { index: false } };
}

export default function Page() {
  return <Suspense><LoginForm /></Suspense>;
}
