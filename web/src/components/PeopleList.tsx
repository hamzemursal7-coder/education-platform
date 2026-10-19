import type { ReactNode } from "react";

const avatarColors = ["bg-orange-400", "bg-teal-500", "bg-blue-500", "bg-sky-500", "bg-rose-400", "bg-emerald-500"];

export function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "").join("") || "?";
}

export function avatarTone(seed: string) {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) hash = (hash + seed.charCodeAt(index)) % avatarColors.length;
  return avatarColors[hash];
}

export function Avatar({ name, seed, photoUrl, size = "md" }: { name: string; seed: string; photoUrl?: string | null; size?: "sm" | "md" }) {
  const box = size === "sm" ? "h-9 w-9 text-xs" : "h-11 w-11 text-sm";
  if (photoUrl) {
    return <img src={photoUrl} alt="" className={`${box} rounded-full object-cover`} />;
  }
  return (
    <div className={`grid ${box} place-items-center rounded-full font-semibold text-white ${avatarTone(seed)}`}>
      {initials(name)}
    </div>
  );
}

export function FilterBar({ children }: { children: ReactNode }) {
  return (
    <div className="grid gap-3 rounded-xl border border-[#e2e8f0] bg-white p-3 shadow-sm md:grid-cols-4">
      {children}
    </div>
  );
}

export function filterInputClass() {
  return "h-10 rounded-lg border border-[#e2e8f0] bg-white px-3 text-sm text-slate-800";
}

export function DataTable({
  headers,
  children,
  empty,
}: {
  headers: string[];
  children: ReactNode;
  empty?: string;
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-[#e2e8f0] bg-white shadow-sm">
      <table className="min-w-full text-left text-[13px] text-slate-800">
        <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
          <tr>
            {headers.map((header) => (
              <th key={header} className="px-3 py-2.5 font-semibold">{header}</th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
      {empty ? <p className="border-t border-slate-100 px-3 py-6 text-[13px] text-slate-500">{empty}</p> : null}
    </div>
  );
}

export function FeeBadge({ balance, status }: { balance: number; status: string }) {
  if (status === "NONE") return <span className="text-slate-400">—</span>;
  const tone =
    status === "PAID"
      ? "bg-emerald-100 text-emerald-700"
      : status === "PARTIAL"
        ? "bg-amber-100 text-amber-700"
        : "bg-rose-100 text-rose-700";
  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${tone}`}>
      {balance.toLocaleString()} · {status}
    </span>
  );
}
