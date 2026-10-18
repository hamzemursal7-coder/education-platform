import { useEffect, useState } from "react";
import { api } from "../lib/api";

type AuditRow = {
  id: string;
  action: string;
  entityType: string;
  summary: string;
  createdAt: string;
  actor: string;
  actorEmail: string;
};

export function AuditPage() {
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    api<AuditRow[]>("/api/v1/audit")
      .then(setRows)
      .catch((caught: unknown) => setError(caught instanceof Error ? caught.message : "Could not load audit log."));
  }, []);

  return (
    <div className="space-y-3">
      {rows.map((row) => (
        <article key={row.id} className="rounded-xl border border-slate-200 bg-white p-4 text-slate-800 shadow-sm">
          <p className="font-semibold">{row.action} · {row.entityType}</p>
          <p className="mt-1">{row.summary}</p>
          <p className="mt-1 text-sm text-slate-500">{new Date(row.createdAt).toLocaleString()} · {row.actor} · {row.actorEmail}</p>
        </article>
      ))}
      {!rows.length && !error ? <p className="text-slate-500">No audit events yet.</p> : null}
      {error ? <p className="text-red-600">{error}</p> : null}
    </div>
  );
}
