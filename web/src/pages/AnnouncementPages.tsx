import { useEffect, useState, type FormEvent } from "react";
import {
  AlertTriangle,
  Archive,
  Bell,
  CheckCircle,
  Clock,
  Eye,
  Filter,
  Megaphone,
  Pin,
  Plus,
  Search,
  Send,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { api } from "../lib/api";

type Announcement = {
  id: string;
  title: string;
  body: string;
  status: "PUBLISHED" | "DRAFT" | "ARCHIVED" | string;
  priority: "NORMAL" | "HIGH" | "URGENT" | string;
  audience: "ALL" | "PARENTS" | "TEACHERS" | "STAFF" | "STUDENTS" | "ALUMNI" | string;
  pinned: boolean;
  publishAt: string | null;
  expiresAt: string | null;
  createdAt: string;
  read?: boolean;
  readCount?: number;
};

const audienceLabels: Record<string, string> = {
  ALL: "All School",
  PARENTS: "Parents",
  TEACHERS: "Teachers",
  STAFF: "Staff",
  STUDENTS: "Students",
  ALUMNI: "Alumni",
};

export function SchoolAnnouncementsPage() {
  const [rows, setRows] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"ALL" | "PUBLISHED" | "DRAFT" | "ARCHIVED">("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [audienceFilter, setAudienceFilter] = useState("ALL");

  // Form states
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [audience, setAudience] = useState("ALL");
  const [priority, setPriority] = useState<"NORMAL" | "HIGH" | "URGENT">("NORMAL");
  const [pinned, setPinned] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function load() {
    setLoading(true);
    try {
      const data = await api<Announcement[]>("/api/v1/announcements");
      setRows(data);
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : "Could not load announcements.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleCreate(publishNow: boolean) {
    if (!title.trim() || !body.trim()) {
      setError("Please provide both a title and message body.");
      return;
    }

    setError("");
    setSubmitting(true);
    try {
      await api("/api/v1/announcements", {
        method: "POST",
        body: JSON.stringify({
          title: title.trim(),
          body: body.trim(),
          audience,
          priority,
          pinned,
          publishNow,
        }),
      });

      setTitle("");
      setBody("");
      setAudience("ALL");
      setPriority("NORMAL");
      setPinned(false);
      setCreateOpen(false);
      setMessage(publishNow ? "Announcement published successfully." : "Draft saved successfully.");
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Failed to create announcement.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleTogglePin(announcement: Announcement) {
    try {
      await api(`/api/v1/announcements/${announcement.id}/pin`, {
        method: "POST",
        body: JSON.stringify({ pinned: !announcement.pinned }),
      });
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Failed to update pin status.");
    }
  }

  async function handlePublish(id: string) {
    try {
      await api(`/api/v1/announcements/${id}/publish`, { method: "POST" });
      setMessage("Announcement published.");
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Failed to publish announcement.");
    }
  }

  async function handleArchive(id: string) {
    try {
      await api(`/api/v1/announcements/${id}/archive`, { method: "POST" });
      setMessage("Announcement archived.");
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Failed to archive announcement.");
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Are you sure you want to permanently delete this announcement?")) return;
    try {
      await api(`/api/v1/announcements/${id}`, { method: "DELETE" });
      setMessage("Announcement deleted.");
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Failed to delete announcement.");
    }
  }

  // Filter rows
  const filteredRows = rows.filter((r) => {
    if (activeTab !== "ALL" && r.status !== activeTab) return false;
    if (audienceFilter !== "ALL" && r.audience !== audienceFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return r.title.toLowerCase().includes(q) || r.body.toLowerCase().includes(q);
    }
    return true;
  });

  const publishedCount = rows.filter((r) => r.status === "PUBLISHED").length;
  const draftCount = rows.filter((r) => r.status === "DRAFT").length;
  const archivedCount = rows.filter((r) => r.status === "ARCHIVED").length;

  return (
    <div className="space-y-6">
      {/* Top Banner & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xs">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="grid h-10 w-10 place-items-center rounded-2xl bg-blue-50 text-[#2563eb]">
              <Megaphone className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">School Announcements</h1>
              <p className="text-xs text-slate-500">
                Broadcast official updates, urgent alerts, and notifications to school audiences.
              </p>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            setCreateOpen(true);
            setError("");
          }}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#2563eb] hover:bg-blue-700 px-4 py-2.5 text-xs font-bold text-white shadow-sm transition"
        >
          <Plus className="h-4 w-4" />
          <span>New Announcement</span>
        </button>
      </div>

      {message && (
        <div className="flex items-center justify-between rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-semibold text-emerald-800 animate-in fade-in">
          <span>{message}</span>
          <button onClick={() => setMessage("")} className="text-emerald-600 hover:text-emerald-800">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {error && (
        <div className="flex items-center justify-between rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-semibold text-rose-800 animate-in fade-in">
          <span>{error}</span>
          <button onClick={() => setError("")} className="text-rose-600 hover:text-rose-800">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Creation Modal / Form */}
      {createOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm overflow-y-auto animate-in fade-in">
          <div className="relative w-full max-w-xl rounded-3xl bg-white p-6 sm:p-8 shadow-2xl my-8 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="grid h-9 w-9 place-items-center rounded-xl bg-blue-50 text-[#2563eb]">
                  <Megaphone className="h-4.5 w-4.5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900">Create Announcement</h2>
                  <p className="text-[11px] text-slate-500">Draft or publish a notice to your school.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCreateOpen(false)}
                className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Title *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Mid-term Exam Schedule & Preparation"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs sm:text-sm font-medium text-slate-900 focus:border-[#2563eb] focus:outline-none"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Audience
                  </label>
                  <select
                    value={audience}
                    onChange={(e) => setAudience(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-800 focus:border-[#2563eb] focus:outline-none"
                  >
                    <option value="ALL">All School (Everyone)</option>
                    <option value="PARENTS">Parents Only</option>
                    <option value="TEACHERS">Teachers Only</option>
                    <option value="STUDENTS">Students Only</option>
                    <option value="STAFF">Staff Only</option>
                    <option value="ALUMNI">Alumni Only</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Priority
                  </label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as any)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-800 focus:border-[#2563eb] focus:outline-none"
                  >
                    <option value="NORMAL">Normal Priority</option>
                    <option value="HIGH">High Priority</option>
                    <option value="URGENT">Urgent Notice</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Message Content *
                </label>
                <textarea
                  rows={5}
                  placeholder="Write the full announcement details here..."
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs sm:text-sm font-normal text-slate-800 focus:border-[#2563eb] focus:outline-none"
                  required
                />
              </div>

              {/* Pin toggle */}
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="pinNotice"
                  checked={pinned}
                  onChange={(e) => setPinned(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-[#2563eb] focus:ring-blue-500"
                />
                <label htmlFor="pinNotice" className="text-xs font-semibold text-slate-700 cursor-pointer flex items-center gap-1.5">
                  <Pin className="h-3.5 w-3.5 text-amber-500" />
                  Pin this announcement to the top of everyone's feed
                </label>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setCreateOpen(false)}
                className="rounded-xl px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={() => handleCreate(false)}
                className="rounded-xl border border-slate-200 bg-white hover:bg-slate-50 px-4 py-2 text-xs font-bold text-slate-700 shadow-2xs transition disabled:opacity-50"
              >
                Save as Draft
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={() => handleCreate(true)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#2563eb] hover:bg-blue-700 px-5 py-2 text-xs font-bold text-white shadow-sm transition disabled:opacity-50"
              >
                <Send className="h-3.5 w-3.5" />
                <span>Publish Now</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Filter Tabs & Search Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-200 pb-3">
        <div className="flex items-center gap-1 overflow-x-auto pb-1 md:pb-0">
          <button
            type="button"
            onClick={() => setActiveTab("ALL")}
            className={`rounded-xl px-3.5 py-1.5 text-xs font-bold transition whitespace-nowrap ${
              activeTab === "ALL"
                ? "bg-[#2563eb] text-white shadow-xs"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            }`}
          >
            All ({rows.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("PUBLISHED")}
            className={`rounded-xl px-3.5 py-1.5 text-xs font-bold transition whitespace-nowrap ${
              activeTab === "PUBLISHED"
                ? "bg-[#2563eb] text-white shadow-xs"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            }`}
          >
            Published ({publishedCount})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("DRAFT")}
            className={`rounded-xl px-3.5 py-1.5 text-xs font-bold transition whitespace-nowrap ${
              activeTab === "DRAFT"
                ? "bg-[#2563eb] text-white shadow-xs"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            }`}
          >
            Drafts ({draftCount})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("ARCHIVED")}
            className={`rounded-xl px-3.5 py-1.5 text-xs font-bold transition whitespace-nowrap ${
              activeTab === "ARCHIVED"
                ? "bg-[#2563eb] text-white shadow-xs"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            }`}
          >
            Archived ({archivedCount})
          </button>
        </div>

        {/* Search & Audience dropdown */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1 sm:w-56">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search notices..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white pl-8 pr-3 py-1.5 text-xs font-medium text-slate-800 placeholder:text-slate-400 focus:border-[#2563eb] focus:outline-none"
            />
          </div>

          <select
            value={audienceFilter}
            onChange={(e) => setAudienceFilter(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 focus:border-[#2563eb] focus:outline-none"
          >
            <option value="ALL">All Audiences</option>
            <option value="PARENTS">Parents</option>
            <option value="TEACHERS">Teachers</option>
            <option value="STUDENTS">Students</option>
            <option value="STAFF">Staff</option>
            <option value="ALUMNI">Alumni</option>
          </select>
        </div>
      </div>

      {/* Announcements List */}
      {loading ? (
        <div className="py-12 text-center text-xs font-semibold text-slate-400">Loading announcements...</div>
      ) : filteredRows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-12 text-center">
          <Megaphone className="mx-auto h-8 w-8 text-slate-300 mb-2" />
          <h3 className="text-sm font-bold text-slate-800">No Announcements Found</h3>
          <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
            {searchQuery || audienceFilter !== "ALL"
              ? "Try adjusting your search query or audience filter."
              : "Create your first school announcement to broadcast updates to parents, teachers, and students."}
          </p>
        </div>
      ) : (
        <div className="grid gap-4">
          {filteredRows.map((row) => {
            const isPinned = row.pinned;
            const isUrgent = row.priority === "URGENT";
            const isHigh = row.priority === "HIGH";

            const priorityBadge = isUrgent
              ? "bg-rose-50 text-rose-700 border-rose-200"
              : isHigh
              ? "bg-amber-50 text-amber-700 border-amber-200"
              : "bg-slate-100 text-slate-600 border-slate-200";

            const statusBadge =
              row.status === "PUBLISHED"
                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                : row.status === "DRAFT"
                ? "bg-slate-100 text-slate-600 border-slate-200"
                : "bg-purple-50 text-purple-700 border-purple-200";

            const formattedDate = new Date(row.createdAt).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            });

            return (
              <article
                key={row.id}
                className={`relative rounded-2xl border bg-white p-5 shadow-xs transition-all hover:border-blue-200 ${
                  isPinned ? "border-amber-200/90 ring-1 ring-amber-100" : "border-slate-200/80"
                }`}
              >
                {/* Pinned pill */}
                {isPinned && (
                  <div className="mb-2.5 inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700 border border-amber-200/60">
                    <Pin className="h-3 w-3 fill-amber-500" />
                    <span>PINNED TO TOP</span>
                  </div>
                )}

                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 mb-1.5">
                      <span className={`inline-block rounded-md border px-2 py-0.5 text-[10px] font-bold ${priorityBadge}`}>
                        {row.priority}
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 border border-blue-100 px-2 py-0.5 text-[10px] font-bold text-[#2563eb]">
                        <Users className="h-2.5 w-2.5" />
                        {audienceLabels[row.audience] ?? row.audience}
                      </span>
                      <span className={`inline-block rounded-md border px-2 py-0.5 text-[10px] font-bold ${statusBadge}`}>
                        {row.status}
                      </span>
                    </div>

                    <h2 className="text-base font-bold text-slate-900 tracking-tight">{row.title}</h2>
                    <p className="mt-2 text-xs sm:text-sm text-slate-600 whitespace-pre-wrap leading-relaxed">
                      {row.body}
                    </p>

                    <div className="mt-4 flex flex-wrap items-center gap-4 text-[11px] text-slate-400">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formattedDate}
                      </span>
                      <span className="flex items-center gap-1">
                        <Eye className="h-3 w-3 text-slate-500" />
                        <strong className="text-slate-700">{row.readCount ?? 0}</strong> views
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex sm:flex-col items-center sm:items-end gap-1.5 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                    {row.status === "DRAFT" && (
                      <button
                        type="button"
                        onClick={() => handlePublish(row.id)}
                        className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 px-2.5 py-1 text-xs font-bold text-white shadow-2xs transition"
                        title="Publish Draft"
                      >
                        <Send className="h-3 w-3" />
                        <span>Publish</span>
                      </button>
                    )}

                    {row.status !== "ARCHIVED" && (
                      <button
                        type="button"
                        onClick={() => handleArchive(row.id)}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-600 transition"
                        title="Archive Announcement"
                      >
                        <Archive className="h-3 w-3" />
                        <span>Archive</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => handleTogglePin(row)}
                      className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-semibold transition ${
                        isPinned
                          ? "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100"
                          : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                      }`}
                      title={isPinned ? "Unpin Notice" : "Pin Notice"}
                    >
                      <Pin className="h-3 w-3" />
                      <span>{isPinned ? "Unpin" : "Pin"}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDelete(row.id)}
                      className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-white hover:bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-600 transition"
                      title="Delete Announcement"
                    >
                      <Trash2 className="h-3 w-3" />
                      <span>Delete</span>
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function AnnouncementsInboxPage() {
  const [rows, setRows] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    try {
      const data = await api<Announcement[]>("/api/v1/announcements/inbox");
      setRows(data);
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : "Could not load inbox.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
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
      <div className="flex items-center gap-2.5 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs">
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-blue-50 text-[#2563eb]">
          <Bell className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-base font-bold text-slate-900">Announcements Feed</h1>
          <p className="text-xs text-slate-500">Official updates published by school administration.</p>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-800">
          {error}
        </div>
      )}

      {loading ? (
        <div className="py-12 text-center text-xs font-semibold text-slate-400">Loading notices...</div>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-12 text-center">
          <Bell className="mx-auto h-8 w-8 text-slate-300 mb-2" />
          <p className="text-sm font-bold text-slate-800">No Announcements</p>
          <p className="text-xs text-slate-400 mt-1">You are all caught up!</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {rows.map((row) => {
            const formattedDate = new Date(row.createdAt).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            });

            return (
              <article
                key={row.id}
                className={`rounded-2xl border p-5 shadow-xs transition-all ${
                  row.read
                    ? "border-slate-200 bg-white"
                    : "border-blue-200 bg-gradient-to-r from-blue-50/40 via-white to-white"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 mb-1.5">
                      {!row.read && (
                        <span className="rounded-md bg-[#2563eb] px-2 py-0.5 text-[10px] font-extrabold text-white">
                          NEW
                        </span>
                      )}
                      {row.pinned && (
                        <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 border border-amber-200 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                          <Pin className="h-2.5 w-2.5 fill-amber-500" />
                          PINNED
                        </span>
                      )}
                      <span className="rounded-md bg-slate-100 border border-slate-200 px-2 py-0.5 text-[10px] font-bold text-slate-700">
                        {row.priority}
                      </span>
                    </div>

                    <h2 className="text-sm sm:text-base font-bold text-slate-900">{row.title}</h2>
                    <p className="mt-1.5 text-xs text-slate-600 whitespace-pre-wrap leading-relaxed">{row.body}</p>
                    <span className="mt-3 block text-[11px] text-slate-400">{formattedDate}</span>
                  </div>

                  {!row.read && (
                    <button
                      type="button"
                      onClick={() => markRead(row.id)}
                      className="inline-flex items-center gap-1 rounded-xl bg-blue-50 border border-blue-200 hover:bg-blue-100 px-3 py-1.5 text-xs font-bold text-[#2563eb] transition whitespace-nowrap"
                    >
                      <CheckCircle className="h-3.5 w-3.5" />
                      <span>Mark Read</span>
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
