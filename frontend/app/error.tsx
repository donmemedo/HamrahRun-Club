"use client";
import { useApp } from "@/components/ui";

export default function Error({ retry, reset }: { error: Error & { digest?: string }; retry?: () => void; reset: () => void }) {
  const { d } = useApp();
  return (
    <div role="alert" className="mx-auto flex min-h-[70dvh] max-w-md flex-col items-center justify-center gap-4 px-5 text-center">
      <h1 className="text-2xl font-bold">{d.error}</h1>
      <button onClick={() => (retry ?? reset)()} className="h-12 rounded-full bg-accent px-7 font-semibold text-white active:scale-95">{d.retry}</button>
    </div>
  );
}
