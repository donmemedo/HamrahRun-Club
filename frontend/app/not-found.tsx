import Link from "next/link";
import { dicts } from "@/lib/i18n";
import { getLang } from "@/lib/server";

export default async function NotFound() {
  const d = dicts[await getLang()];
  return (
    <div className="mx-auto flex min-h-[70dvh] max-w-md flex-col items-center justify-center gap-3 px-5 text-center">
      <h1 className="tight text-4xl font-black">{d.notFound.title}</h1>
      <p className="text-fg-2">{d.notFound.sub}</p>
      <Link href="/" className="mt-4 flex h-12 items-center rounded-full bg-accent px-7 font-semibold text-white active:scale-95">{d.notFound.home}</Link>
    </div>
  );
}
