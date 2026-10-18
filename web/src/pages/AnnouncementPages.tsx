import { useEffect, useState } from "react";
import { api } from "../lib/api";

type Announcement = {
  id: string;
  title: string;
  body: string;
  status: string;
  priority: string;
  audience: string;
  pinned: boolean;
  publishAt: string | null;
  expiresAt: string | null;
  createdAt: string;
  read?: boolean;
  readCount?: number;
};

export function SchoolAnnouncementsPage() {
  const [rows, setRows] = useState<Announcement[]>([]);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [audience, setAudience] = useState("ALL");
  const [priority, setPriority] = useState("NORMAL");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function load() {
    setRows(await api<Announcement[]>("/api/v1/announcements"));
  }

  useEffect(() => {
    load().catch((caught: unknown) => setError(caught instanceof Error ? caught.message : "Could not load announcements."));
  }, []);

  async function create(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    try {
      await api("/api/v1/announcements", {
        method: "POST",
        body: JSON.stringify({ title, body, audience, priority, publishNow: true }),
      });
      setTitle("");
      setBody("");
      setMessage("Announcement published.");
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not publish.");
    }
  }

  async function createDraft(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    try {
      await api("/api/v1/announcements", {
        method: "POST",
        body: JSON.stringify({ title, body, audience, priority, publishNow: false }),
      });
      setTitle("");
      setBody("");
      setMessage("Draft saved.");
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save draft.");
    }
  }

  return (
    <div className="space-y-6">
      <form className="space-y-3 rounded-xl border border-slate-200 bg-white p-5 text-slate-800 shadow-sm">
        <input className="w-full rounded-xl border border-slate-200 bg-[#f9fafb] px-3 py-2 text-slate-800" placeholder="Title" value={title} onChange={(event) => setTitle(event.target.value)} required />
        <textarea className="min-h-28 w-full rounded-xl border border-slate-200 bg-[#f9fafb] px-3 py-2 text-slate-800" placeholder="Message" value={body} onChange={(event) => setBody(event.target.value)} required />
        <div className="grid gap-3 md:grid-cols-2">
          <select className="rounded-xl border border-slate-200 bg-[#f9fafb] px-3 py-2 text-slate-800" value={audience} onChange={(event) => setAudience(event.target.value)}>
            {["ALL", "PARENTS", "TEACHERS", "STAFF", "STUDENTS", "ALUMNI"].map((item) => (
              <option key={item} value={item}>{item}</option>
            ))}
          </select>
          <select className="rounded-xl border border-slate-200 bg-[#f9fafb] px-3 py-2 text-slate-800" value={priority} onChange={(event) => setPriority(event.target.value)}>
            {["NORMAL", "HIGH", "URGENT"].map((item) => (
              <option key={item} value={item}>{item}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-wrap gap-3">
          <button type="button" className="rounded-xl bg-blue-600 px-4 py-2 font-semibold text-white hover:bg-blue-500" onClick={create}>Publish now</button>
          <button type="button" className="rounded-xl border border-slate-300 bg-white px-4 py-2 font-semibold text-slate-700" onClick={createDraft}>Save draft</button>
        </div>
      </form>
      {rows.map((row) => (
        <article key={row.id} className="rounded-xl border border-slate-200 bg-white p-5 text-slate-800 shadow-sm">
          <p className="font-semibold">{row.pinned ? "Pinned · " : ""}{row.title}</p>
          <p className="text-sm text-slate-500">{row.status} · {row.audience} · {row.priority} · reads {row.readCount ?? 0}</p>
          <p className="mt-2 whitespace-pre-wrap">{row.body}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {row.status === "DRAFT" ? (
              <button type="button" className="rounded-xl bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-500" onClick={() => api(`/api/v1/announcements/${row.id}/publish`, { method: "POST" }).then(load).catch((caught: unknown) => setError(caught instanceof Error ? caught.message : "Publish failed."))}>Publish</button>
            ) : null}
            {row.status !== "ARCHIVED" ? (
              <button type="button" className="rounded-xl bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-500" onClick={() => api(`/api/v1/announcements/${row.id}/archive`, { method: "POST" }).then(load).catch((caught: unknown) => setError(caught instanceof Error ? caught.message : "Archive failed."))}>Archive</button>
            ) : null}
            <button type="button" className="rounded-xl bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-500" onClick={() => api(`/api/v1/announcements/${row.id}/pin`, { method: "POST", body: JSON.stringify({ pinned: !row.pinned }) }).then(load).catch((caught: unknown) => setError(caught instanceof Error ? caught.message : "Pin failed."))}>
              {row.pinned ? "Unpin" : "Pin"}
            </button>
          </div>
        </article>
      ))}
      {message ? <p className="text-blue-600">{message}</p> : null}
      {error ? <p className="text-red-600">{error}</p> : null}
    </div>
  );
}

export function AnnouncementsInboxPage() {
  const [rows, setRows] = useState<Announcement[]>([]);
  const [error, setError] = useState("");

  async function load() {
    setRows(await api<Announcement[]>("/api/v1/announcements/inbox"));
  }

  useEffect(() => {
    load().catch((caught: unknown) => setError(caught instanceof Error ? caught.message : "Could not load inbox."));
  }, []);

  async function markRead(id: string) {
    try {
      await api(`/api/v1/announcements/${id}/read`, { method: "POST" });
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not mark as read.");
    }
  }

  return (
    <div className="space-y-4">
      {rows.map((row) => (
        <article key={row.id} className={`rounded-xl border p-5 shadow-sm ${row.read ? "border-slate-200 bg-white text-slate-800" : "border-blue-200 bg-blue-50 text-slate-800"}`}>
          <p className="font-semibold">{row.pinned ? "Pinned · " : ""}{row.title}</p>
          <p className="text-sm text-slate-500">{row.priority} · {row.audience}{row.read ? " · Read" : " · Unread"}</p>
          <p className="mt-2 whitespace-pre-wrap">{row.body}</p>
          {!row.read ? (
            <button type="button" className="mt-3 rounded-xl bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-500" onClick={() => markRead(row.id)}>
              Mark as read
            </button>
          ) : null}
        </article>
      ))}
      {!rows.length ? <p className="text-slate-500">No announcements right now.</p> : null}
      {error ? <p className="text-red-600">{error}</p> : null}
    </div>
  );
}
