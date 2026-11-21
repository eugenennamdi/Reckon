export default function Loading() {
  return (
    <div className="space-y-10 animate-pulse">
      <div className="grid gap-8 border-b border-black/[0.06] pb-9 lg:grid-cols-12">
        <div className="space-y-4 lg:col-span-7">
          <div className="h-3 w-48 rounded bg-black/[0.06]" />
          <div className="h-10 w-80 max-w-full rounded-lg bg-black/[0.08]" />
          <div className="h-4 w-full max-w-lg rounded bg-black/[0.05]" />
        </div>
        <div className="h-36 rounded-2xl bg-card ring-1 ring-black/[0.06] lg:col-span-5" />
      </div>
      <div className="grid gap-8 lg:grid-cols-12">
        <div className="space-y-4 lg:col-span-7">
          <div className="h-36 rounded-2xl bg-card ring-1 ring-black/[0.06]" />
          <div className="h-36 rounded-2xl bg-card ring-1 ring-black/[0.06]" />
        </div>
        <div className="h-96 rounded-2xl bg-card ring-1 ring-black/[0.06] lg:col-span-5" />
      </div>
    </div>
  );
}
