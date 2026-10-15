import { AppMark } from "@/components/AppMark";

export function MascotLoader({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-5 text-stone-500">
      <div className="relative flex items-center justify-center">
        <div
          aria-hidden
          className="absolute inset-0 -m-6 rounded-full blur-2xl opacity-40"
          style={{ background: "radial-gradient(circle, #fda4af 0%, transparent 70%)" }}
        />
        <div className="relative animate-bounce" style={{ animationDuration: "1.6s" }}>
          <AppMark className="h-16 w-16" />
        </div>
      </div>
      <p className="text-sm tracking-wide">{label}</p>
    </div>
  );
}
