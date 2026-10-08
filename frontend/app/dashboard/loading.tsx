// Skeleton in the dashboard's own grid, so content lands where the placeholders were (no layout shift).
export default function Loading() {
  const block = "animate-pulse rounded-[28px] bg-line";
  return (
    <div className="mx-auto max-w-6xl px-5 pb-16 pt-28 md:pt-32" aria-busy="true">
      <div className={`h-12 w-56 ${block}`} />
      <div className="mt-8 grid gap-5 lg:grid-cols-[400px_1fr]">
        <div className="space-y-5"><div className={`aspect-[1.586] ${block}`} /><div className={`h-24 ${block}`} /></div>
        <div className="grid gap-5 sm:grid-cols-2">
          <div className={`h-44 ${block}`} /><div className={`h-44 ${block}`} /><div className={`h-36 sm:col-span-2 ${block}`} />
        </div>
      </div>
    </div>
  );
}
