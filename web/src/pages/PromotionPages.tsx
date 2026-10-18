import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { GraduationCap, Loader2, Users } from "lucide-react";
import { api } from "../lib/api";

type YearOption = {
  id: string;
  name: string;
  startDate: string;
  isCurrent: boolean;
  classes: Array<{ id: string; level: string; label: string; sections: Array<{ id: string; name: string }> }>;
};

type SectionChoice = { id: string; name: string };

type PromotionRow = {
  enrollmentId: string;
  studentId: string;
  permanentId: string;
  name: string;
  gender: string;
  levelLabel: string;
  section: string;
  term2Average: number | null;
  status: "PASS" | "FAIL" | "REVIEW" | "GRADUATION" | "PENDING";
  recommended: "PROMOTE" | "RETAIN" | "ALUMNI" | null;
  blocked: boolean;
  blockReason: string | null;
  remarks: string;
  destinationLabel: string | null;
  promoteLabel: string | null;
  repeatLabel: string;
  promoteSections: SectionChoice[];
  repeatSections: SectionChoice[];
  selected: boolean;
  action: "PROMOTE" | "RETAIN" | "ALUMNI" | "";
  targetSectionId: string;
};

type SectionPayload = {
  ready: boolean;
  blockers: string[];
  scope: { schoolName: string; fromYear: string; toYear: string; levelLabel: string; section: string };
  counts: { total: number; promote: number; repeat: number; alumni: number; pending: number };
  rows: Omit<PromotionRow, "selected" | "action" | "targetSectionId">[];
};

const statusLabel: Record<PromotionRow["status"], string> = {
  PASS: "Pass",
  FAIL: "Fail",
  REVIEW: "Borderline",
  GRADUATION: "Eligible for Completion",
  PENDING: "Results Not Yet Published",
};

const statusClass: Record<PromotionRow["status"], string> = {
  PASS: "bg-emerald-50 text-emerald-700",
  FAIL: "bg-rose-50 text-rose-700",
  REVIEW: "bg-amber-50 text-amber-700",
  GRADUATION: "bg-blue-50 text-blue-700",
  PENDING: "bg-slate-100 text-slate-600",
};

function percent(value: number | null) {
  if (value === null) return "—";
  return Number.isInteger(value) ? `${value}%` : `${value.toFixed(1)}%`;
}

function defaultAction(row: SectionPayload["rows"][number]): PromotionRow["action"] {
  return row.blocked ? "" : row.recommended ?? "";
}

type FilterKey = "ALL" | "PROMOTE" | "RETAIN" | "ALUMNI" | "REVIEW" | "BLOCKED";

function defaultSection(row: SectionPayload["rows"][number], action: PromotionRow["action"]) {
  const list = action === "PROMOTE" ? row.promoteSections : action === "RETAIN" ? row.repeatSections : [];
  return list[0]?.id ?? "";
}

function canPromote(row: Pick<PromotionRow, "blocked" | "status" | "promoteLabel" | "promoteSections">) {
  return !row.blocked && row.status !== "FAIL" && row.status !== "GRADUATION" && Boolean(row.promoteLabel) && row.promoteSections.length > 0;
}

function canAlumni(row: Pick<PromotionRow, "blocked" | "status" | "levelLabel">) {
  return !row.blocked && row.status !== "FAIL" && (row.levelLabel === "Class 8" || row.levelLabel === "Form 4");
}

function sectionsFor(row: PromotionRow) {
  if (row.action === "PROMOTE") return row.promoteSections;
  if (row.action === "RETAIN") return row.repeatSections;
  return [];
}

function destinationText(row: PromotionRow) {
  if (row.action === "ALUMNI") return "Alumni — no next enrollment";
  const sectionName = sectionsFor(row).find((item) => item.id === row.targetSectionId)?.name ?? "—";
  if (row.action === "RETAIN") return `Repeat ${row.repeatLabel || row.levelLabel} · Section ${sectionName}`;
  if (row.action === "PROMOTE") return `Promote to ${row.promoteLabel ?? "the next class"} · Section ${sectionName}`;
  return "No outcome selected";
}

function destinationPlace(row: PromotionRow, year: string) {
  if (row.action === "ALUMNI") return { label: "Alumni", detail: `Completes ${row.levelLabel} · ${year}`, tone: "bg-rose-50 text-rose-700" };
  const sectionName = sectionsFor(row).find((item) => item.id === row.targetSectionId)?.name ?? "—";
  if (row.action === "RETAIN") return { label: row.repeatLabel || row.levelLabel, detail: `Section ${sectionName} · ${year}`, tone: "bg-amber-50 text-amber-800" };
  if (row.action === "PROMOTE") return { label: row.promoteLabel ?? "Next class", detail: `Section ${sectionName} · ${year}`, tone: "bg-emerald-50 text-emerald-800" };
  return { label: "—", detail: "No outcome", tone: "bg-slate-100 text-slate-600" };
}

function PromotionReviewTable({ rows, fromYear, toYear }: { rows: PromotionRow[]; fromYear: string; toYear: string }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200">
      <table className="w-full min-w-[760px] text-left text-sm">
        <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
          <tr>
            {["#", "Student", "Class", "Section", "Year", "Going to"].map((heading) => <th key={heading} className="px-3 py-3 font-medium">{heading}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => {
            const place = destinationPlace(row, row.action === "ALUMNI" ? fromYear : toYear);
            return (
              <tr key={row.enrollmentId} className="border-t border-slate-100">
                <td className="px-3 py-3 text-slate-400">{index + 1}</td>
                <td className="px-3 py-3">
                  <p className="font-semibold text-slate-950">{row.name}</p>
                  <p className="text-xs text-slate-500">{row.permanentId}</p>
                </td>
                <td className="px-3 py-3 font-medium text-slate-800">{row.levelLabel}</td>
                <td className="px-3 py-3 text-slate-700">Section {row.section}</td>
                <td className="px-3 py-3 text-slate-700">{fromYear}</td>
                <td className="px-3 py-3">
                  <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${place.tone}`}>{place.label}</span>
                  <p className="mt-1 text-xs text-slate-500">{place.detail}</p>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function assignmentProblem(row: PromotionRow) {
  if (!row.selected) return null;
  if (row.blocked) return row.blockReason || "Results are not ready.";
  if (!row.action) return "Choose an outcome.";
  if (row.action === "ALUMNI") return null;
  const sections = sectionsFor(row);
  if (!sections.length) return "The destination class is not configured in the next academic year.";
  if (!sections.some((item) => item.id === row.targetSectionId)) return "Choose a destination section.";
  return null;
}

function share(count: number, total: number) {
  if (!total) return "0% of total";
  const value = (count / total) * 100;
  return `${Number.isInteger(value) ? value : value.toFixed(1)}% of total`;
}

function startsAfter(year: YearOption, other: YearOption) {
  return new Date(year.startDate).getTime() > new Date(other.startDate).getTime();
}

function initialYears(years: YearOption[]) {
  const ordered = [...years].sort((left, right) => new Date(left.startDate).getTime() - new Date(right.startDate).getTime());
  const current = years.find((year) => year.isCurrent) ?? ordered.at(-1);
  if (!current) return { source: undefined, destination: undefined };
  const later = ordered.find((year) => startsAfter(year, current));
  if (later) return { source: current, destination: later };
  const earlier = [...ordered].reverse().find((year) => startsAfter(current, year));
  return earlier ? { source: earlier, destination: current } : { source: current, destination: undefined };
}

export function PromotionPage() {
  const [years, setYears] = useState<YearOption[]>([]);
  const [fromYearId, setFromYearId] = useState("");
  const [toYearId, setToYearId] = useState("");
  const [classId, setClassId] = useState("");
  const [sectionId, setSectionId] = useState("");
  const [payload, setPayload] = useState<SectionPayload | null>(null);
  const [rows, setRows] = useState<PromotionRow[]>([]);
  const [filter, setFilter] = useState<FilterKey>("ALL");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [reviewed, setReviewed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [bulkOutcome, setBulkOutcome] = useState<"" | PromotionRow["action"]>("");
  const [bulkSectionId, setBulkSectionId] = useState("");
  const requestRef = useRef(0);

  useEffect(() => {
    api<{ years: YearOption[] }>("/api/v1/promotion/options")
      .then((data) => {
        setYears(data.years);
        const { source, destination } = initialYears(data.years);
        setFromYearId(source?.id ?? "");
        setToYearId(destination?.id ?? "");
        setClassId(source?.classes[0]?.id ?? "");
        setSectionId(source?.classes[0]?.sections[0]?.id ?? "");
      })
      .catch((caught: unknown) => setError(caught instanceof Error ? caught.message : "Could not load academic years."));
  }, []);

  useEffect(() => {
    const request = ++requestRef.current;
    const source = years.find((year) => year.id === fromYearId);
    const selected = source?.classes.find((item) => item.sections.some((section) => section.id === sectionId));
    const terminal = selected?.label === "Class 8" || selected?.label === "Form 4";
    const destination = years.find((year) => year.id === toYearId);
    const destinationReady = Boolean(toYearId && fromYearId !== toYearId && source && destination && startsAfter(destination, source));
    if (!fromYearId || !sectionId || (!terminal && !destinationReady)) {
      setPayload(null);
      setRows([]);
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    setError("");
    setPreviewOpen(false);
    setConfirmOpen(false);
    setReviewed(false);
    api<SectionPayload>(`/api/v1/promotion/section?fromYearId=${fromYearId}&sectionId=${sectionId}${destinationReady ? `&toYearId=${toYearId}` : ""}`, { signal: controller.signal })
      .then((data) => {
        if (request !== requestRef.current) return;
        setPayload(data);
        setRows(data.rows.map((row) => {
          const action = defaultAction(row);
          return { ...row, selected: !row.blocked && Boolean(action), action, targetSectionId: defaultSection(row, action) };
        }));
        setPage(1);
      })
      .catch((caught: unknown) => {
        if (request !== requestRef.current) return;
        if (caught instanceof DOMException && caught.name === "AbortError") return;
        setPayload(null);
        setRows([]);
        setError(caught instanceof Error ? caught.message : "Could not load students.");
      })
      .finally(() => {
        if (request === requestRef.current) setLoading(false);
      });
    return () => controller.abort();
  }, [fromYearId, toYearId, sectionId, reloadKey, years]);

  const fromYear = years.find((year) => year.id === fromYearId);
  const toYear = years.find((year) => year.id === toYearId);
  const selectedClass = fromYear?.classes.find((item) => item.id === classId);
  const terminalClass = selectedClass?.label === "Class 8" || selectedClass?.label === "Form 4";
  const laterYears = fromYear ? years.filter((year) => startsAfter(year, fromYear)) : [];
  const destinationInvalid = Boolean(fromYear && toYear && !startsAfter(toYear, fromYear));
  const destinationMissing = !terminalClass && (!toYearId || destinationInvalid);
  const destinationMessage = fromYear && laterYears.length === 0
    ? `${fromYear.name} is the latest academic year. Create a later year before promotion.`
    : fromYear
      ? `Choose a destination year that starts after ${fromYear.name}.`
      : "The destination academic year has not been created.";

  function chooseYear(id: string) {
    const year = years.find((item) => item.id === id);
    setFromYearId(id);
    setToYearId((current) => {
      const destination = years.find((item) => item.id === current);
      if (!year || !destination || !startsAfter(destination, year)) return "";
      return current;
    });
    setClassId(year?.classes[0]?.id ?? "");
    setSectionId(year?.classes[0]?.sections[0]?.id ?? "");
    setQuery("");
  }

  function update(id: string, patch: Partial<PromotionRow>) {
    setReviewed(false);
    setRows((current) => current.map((row) => row.enrollmentId === id ? { ...row, ...patch } : row));
  }

  const visible = rows.filter((row) => {
    const matchesFilter = filter === "ALL"
      || (filter === "REVIEW" && row.status === "REVIEW")
      || (filter === "BLOCKED" && row.blocked)
      || (filter !== "REVIEW" && filter !== "BLOCKED" && row.action === filter);
    const needle = query.trim().toLowerCase();
    return matchesFilter && (!needle || `${row.name} ${row.permanentId}`.toLowerCase().includes(needle));
  });
  const pageCount = Math.max(1, Math.ceil(visible.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const pageRows = visible.slice((safePage - 1) * pageSize, safePage * pageSize);
  const chosen = rows.filter((row) => row.selected && !assignmentProblem(row));
  const summary = useMemo(() => ({
    total: rows.length,
    promote: rows.filter((row) => row.action === "PROMOTE").length,
    repeat: rows.filter((row) => row.action === "RETAIN").length,
    alumni: rows.filter((row) => row.action === "ALUMNI").length,
    review: rows.filter((row) => row.status === "REVIEW").length,
    blocked: rows.filter((row) => row.blocked).length,
  }), [rows]);
  const problems = chosen.length === 0 || rows.some((row) => row.selected && assignmentProblem(row));
  const selectedRows = rows.filter((row) => row.selected);
  const sharedSections = selectedRows.reduce<SectionChoice[] | null>((list, row) => {
    const sections = sectionsFor(row);
    if (!sections.length) return [];
    if (!list) return sections;
    return list.filter((item) => sections.some((section) => section.id === item.id));
  }, null) ?? [];

  function applyBulkOutcome() {
    if (!bulkOutcome) return;
    setReviewed(false);
    setRows((current) => current.map((row) => {
      if (!row.selected || row.blocked) return row;
      if (bulkOutcome === "PROMOTE" && !canPromote(row)) return row;
      if (bulkOutcome === "ALUMNI" && !canAlumni(row)) return row;
      return { ...row, action: bulkOutcome, targetSectionId: defaultSection(row, bulkOutcome) };
    }));
    setBulkOutcome("");
  }

  function applyBulkSection() {
    if (!bulkSectionId) return;
    setReviewed(false);
    setRows((current) => current.map((row) => {
      if (!row.selected || !sectionsFor(row).some((section) => section.id === bulkSectionId)) return row;
      return { ...row, targetSectionId: bulkSectionId };
    }));
    setBulkSectionId("");
  }

  function exportList() {
    const header = ["Student ID", "Student Name", "Gender", "Current Class", "Current Section", "Term 2 Average", "Result Status", "Next Class / Action", "Next Section", "Remarks"];
    const lines = [header, ...visible.map((row) => [
      row.permanentId,
      row.name,
      row.gender,
      row.levelLabel,
      row.section,
      percent(row.term2Average),
      statusLabel[row.status],
      row.action ? destinationText(row) : "Review required",
      sectionsFor(row).find((section) => section.id === row.targetSectionId)?.name ?? "",
      row.blockReason || row.remarks,
    ].map((value) => `"${value.replace(/"/g, '""')}"`).join(","))];
    const url = URL.createObjectURL(new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "student-promotion.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  async function confirm() {
    setError("");
    setPending(true);
    try {
      const result = await api<{ promoted: number; repeated: number; alumni: number }>("/api/v1/promotions", {
        method: "POST",
        body: JSON.stringify({
          fromYearId,
          ...(chosen.some((row) => row.action !== "ALUMNI") ? { toYearId } : {}),
          sectionId,
          decisions: chosen.map((row) => ({
            enrollmentId: row.enrollmentId,
            action: row.action,
            targetSectionId: row.action === "ALUMNI" ? undefined : row.targetSectionId,
          })),
        }),
      });
      const excluded = rows.length - chosen.length;
      setPreviewOpen(false);
      setConfirmOpen(false);
      setMessage(`Promoted ${result.promoted}, repeated ${result.repeated}, alumni ${result.alumni}.${excluded ? ` ${excluded} students were left unchanged.` : ""}`);
      setReloadKey((current) => current + 1);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Promotion failed.");
    } finally {
      setPending(false);
    }
  }

  const step = confirmOpen ? 4 : previewOpen ? 3 : payload ? 2 : 1;
  const steps = ["Select Year & Section", "Review Students", "Preview Changes", "Confirm Promotion"];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-blue-600 text-white"><GraduationCap className="h-5 w-5" /></span>
          <div>
            <h2 className="text-2xl font-semibold text-slate-950">Student Promotion</h2>
            <p className="mt-1 text-sm text-slate-500">Prepare students for the next academic year.</p>
          </div>
        </div>
        <Link to="/school/promotion/history" className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm">View Promotion History</Link>
      </div>

      <div className="grid gap-2 rounded-2xl border border-slate-200 bg-white p-3 text-sm shadow-sm md:grid-cols-4">
        {steps.map((label, index) => (
          <div key={label} className={`flex items-center gap-2 rounded-xl px-3 py-2 ${step === index + 1 ? "bg-blue-50 text-blue-800" : "bg-slate-50 text-slate-500"}`}>
            <span className={`grid h-6 w-6 place-items-center rounded-full text-xs font-semibold text-white ${step === index + 1 ? "bg-blue-600" : "bg-slate-300"}`}>{index + 1}</span>
            {label}
          </div>
        ))}
      </div>

      <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-2 xl:grid-cols-4">
        <label className="text-xs font-medium text-slate-500">Academic year (from)
          <span className="relative mt-1 block">
            <select className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 pr-24 text-sm text-slate-900" value={fromYearId} onChange={(event) => chooseYear(event.target.value)}>
              {years.map((year) => <option key={year.id} value={year.id}>{year.name}</option>)}
            </select>
            {fromYear?.isCurrent ? <span className="pointer-events-none absolute right-8 top-1/2 -translate-y-1/2 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">Current</span> : null}
          </span>
        </label>
        <label className="text-xs font-medium text-slate-500">{terminalClass ? "Next year for students who repeat" : "Next academic year (to)"}
          <span className="relative mt-1 block">
            <select className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 pr-24 text-sm text-slate-900" value={toYearId} onChange={(event) => setToYearId(event.target.value)}>
              <option value="">{laterYears.length ? "Choose a later year" : "Not created yet"}</option>
              {laterYears.map((year) => <option key={year.id} value={year.id}>{year.name}</option>)}
            </select>
            {toYear ? <span className="pointer-events-none absolute right-8 top-1/2 -translate-y-1/2 rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700">{toYear.isCurrent ? "Current" : "Upcoming"}</span> : null}
          </span>
          {terminalClass ? <span className="mt-1 block text-[11px] font-normal text-slate-400">Students at 50% or above become alumni this year. Students below 50% repeat {selectedClass?.label} in the year you choose.</span> : null}
        </label>
        <label className="text-xs font-medium text-slate-500">Class / Form
          <select className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900" value={classId} onChange={(event) => {
            const next = fromYear?.classes.find((item) => item.id === event.target.value);
            setClassId(event.target.value);
            setSectionId(next?.sections[0]?.id ?? "");
            setQuery("");
          }}>
            {(fromYear?.classes ?? []).map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
          </select>
        </label>
        <label className="text-xs font-medium text-slate-500">Section
          <select className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900" value={sectionId} onChange={(event) => { setSectionId(event.target.value); setQuery(""); }}>
            {(selectedClass?.sections ?? []).map((section) => <option key={section.id} value={section.id}>Section {section.name}</option>)}
          </select>
        </label>
      </div>

      {destinationMissing || (terminalClass && laterYears.length === 0) || (payload && payload.blockers.length) ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <p className="font-semibold">Prepare the Next Academic Year First</p>
          <p className="mt-1">{destinationMissing || laterYears.length === 0 ? destinationMessage : payload?.blockers.join(" ")}</p>
          <Link to="/school/academic-years" className="mt-2 inline-block font-medium text-blue-700">Open Academic Years</Link>
        </div>
      ) : null}

      {loading ? <p className="flex items-center gap-2 text-sm text-blue-700"><Loader2 className="h-4 w-4 animate-spin" /> Loading students…</p> : null}
      {payload ? <p className="rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-800">Showing students from {payload.scope.levelLabel} – Section {payload.scope.section} for {payload.scope.fromYear}. Students are automatically loaded.</p> : null}

      {payload ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Metric label="Total Students" value={summary.total} detail={`${payload.scope.levelLabel} – Section ${payload.scope.section}`} tone="bg-blue-50 text-blue-800" />
            <Metric label="To Be Promoted" value={summary.promote} detail={share(summary.promote, summary.total)} tone="bg-emerald-50 text-emerald-800" />
            <Metric label="To Repeat" value={summary.repeat} detail={share(summary.repeat, summary.total)} tone="bg-amber-50 text-amber-800" />
            <Metric label="To Alumni" value={summary.alumni} detail={share(summary.alumni, summary.total)} tone="bg-rose-50 text-rose-800" />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {([
              ["ALL", `All Students (${summary.total})`],
              ["PROMOTE", `To Promote (${summary.promote})`],
              ["RETAIN", `To Repeat (${summary.repeat})`],
              ["ALUMNI", `To Alumni (${summary.alumni})`],
              ["REVIEW", `Review Required (${summary.review})`],
              ["BLOCKED", `Blocked (${summary.blocked})`],
            ] as Array<[FilterKey, string]>).map(([key, label]) => (
              <button key={key} type="button" className={`rounded-full px-3 py-1.5 text-sm ${filter === key ? "bg-blue-600 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200"}`} onClick={() => { setFilter(key); setPage(1); }}>{label}</button>
            ))}
            <input className="ml-auto w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm sm:w-56" placeholder="Search by name or ID" value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} />
          </div>

          {selectedRows.length ? (
            <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-blue-100 bg-blue-50 px-3 py-2 text-sm text-blue-900">
              <span className="font-medium">{selectedRows.length} selected</span>
              <select className="rounded-lg border border-blue-200 bg-white px-2 py-1" value="" onChange={(event) => setBulkOutcome(event.target.value as PromotionRow["action"])}>
                <option value="">Set outcome</option>
                <option value="PROMOTE">Promote</option>
                <option value="RETAIN">Repeat</option>
                <option value="ALUMNI">Alumni</option>
              </select>
              <select className="rounded-lg border border-blue-200 bg-white px-2 py-1" value={bulkSectionId} onChange={(event) => setBulkSectionId(event.target.value)} disabled={!sharedSections.length}>
                <option value="">{sharedSections.length ? "Assign destination section" : "No shared section"}</option>
                {sharedSections.map((section) => <option key={section.id} value={section.id}>Section {section.name}</option>)}
              </select>
              <button type="button" className="rounded-lg bg-white px-2 py-1 ring-1 ring-blue-200" onClick={() => { setReviewed(false); setRows((current) => current.map((row) => ({ ...row, selected: false }))); }}>Clear selection</button>
            </div>
          ) : null}
          {bulkOutcome ? (
            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              <span>Apply this outcome only to the selected students who are allowed to take it?</span>
              <button type="button" className="rounded-lg bg-blue-600 px-3 py-1 font-medium text-white" onClick={applyBulkOutcome}>Apply</button>
              <button type="button" className="rounded-lg bg-white px-3 py-1 ring-1 ring-amber-200" onClick={() => setBulkOutcome("")}>Cancel</button>
            </div>
          ) : null}
          {bulkSectionId ? (
            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              <span>Assign this section only to selected students whose destination class contains it?</span>
              <button type="button" className="rounded-lg bg-blue-600 px-3 py-1 font-medium text-white" onClick={applyBulkSection}>Apply</button>
              <button type="button" className="rounded-lg bg-white px-3 py-1 ring-1 ring-amber-200" onClick={() => setBulkSectionId("")}>Cancel</button>
            </div>
          ) : null}

          <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full min-w-[1100px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-3"><input type="checkbox" checked={pageRows.some((row) => !row.blocked && row.action) && pageRows.filter((row) => !row.blocked && row.action).every((row) => row.selected)} onChange={(event) => {
                    const ids = new Set(pageRows.filter((row) => !row.blocked && row.action).map((row) => row.enrollmentId));
                    setReviewed(false);
                    setRows((current) => current.map((row) => ids.has(row.enrollmentId) ? { ...row, selected: event.target.checked } : row));
                  }} /></th>
                  {["#", "Student ID", "Student Name", "Gender", "Current Class", "Section", "Term 2 Average", "Result Status", "Next Class / Action", "Next Section", "Remarks"].map((heading) => <th key={heading} className="px-3 py-3 font-medium">{heading}</th>)}
                </tr>
              </thead>
              <tbody>
                {pageRows.map((row, index) => {
                  const sections = sectionsFor(row);
                  return (
                    <tr key={row.enrollmentId} className="border-t border-slate-100">
                      <td className="px-3 py-3"><input type="checkbox" checked={row.selected} disabled={row.blocked || !row.action} onChange={(event) => update(row.enrollmentId, { selected: event.target.checked })} /></td>
                      <td className="px-3 py-3 text-slate-400">{(safePage - 1) * pageSize + index + 1}</td>
                      <td className="px-3 py-3 text-slate-500">{row.permanentId}</td>
                      <td className="px-3 py-3 font-medium text-slate-900"><Link className="text-blue-700 hover:underline" to={`/school/students/${row.studentId}`}>{row.name}</Link></td>
                      <td className="px-3 py-3">{row.gender}</td>
                      <td className="px-3 py-3">{row.levelLabel}</td>
                      <td className="px-3 py-3">{row.section}</td>
                      <td className="px-3 py-3 font-semibold text-blue-700">{percent(row.term2Average)}</td>
                      <td className="px-3 py-3"><span className={`rounded-full px-2 py-1 text-xs font-medium ${statusClass[row.status]}`}>{statusLabel[row.status]}</span></td>
                      <td className="px-3 py-3">
                        <select className="max-w-[180px] rounded-lg border border-slate-200 px-2 py-1" value={row.action} disabled={row.blocked} onChange={(event) => {
                          const action = event.target.value as PromotionRow["action"];
                          update(row.enrollmentId, { action, targetSectionId: defaultSection(row, action), selected: Boolean(action) });
                        }}>
                          <option value="">Review required</option>
                          {canPromote(row) ? <option value="PROMOTE">Promote to {row.promoteLabel}</option> : null}
                          {!row.blocked ? <option value="RETAIN">Repeat {row.repeatLabel || row.levelLabel}</option> : null}
                          {canAlumni(row) ? <option value="ALUMNI">Alumni</option> : null}
                        </select>
                      </td>
                      <td className="px-3 py-3">
                        {row.action === "ALUMNI" || !row.action ? "—" : sections.length ? (
                          <select className="rounded-lg border border-slate-200 px-2 py-1" value={row.targetSectionId} onChange={(event) => update(row.enrollmentId, { targetSectionId: event.target.value })}>
                            {sections.map((section) => <option key={section.id} value={section.id}>Section {section.name}</option>)}
                          </select>
                        ) : "Not configured"}
                      </td>
                      <td className="px-3 py-3 text-slate-500">{row.blocked ? row.blockReason : row.status === "PASS" ? "—" : row.remarks}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {!visible.length ? <p className="px-4 py-8 text-center text-sm text-slate-500">{rows.length ? "No students in this view." : "No students are enrolled in this section."}</p> : null}
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 px-3 py-3 text-sm text-slate-500">
              <span>{visible.length ? `Showing ${(safePage - 1) * pageSize + 1}–${Math.min(safePage * pageSize, visible.length)} of ${visible.length}` : "Showing 0 students"}</span>
              <div className="flex items-center gap-2">
                <button type="button" className="rounded-lg border border-slate-200 px-2 py-1 disabled:opacity-40" disabled={safePage <= 1} onClick={() => setPage(safePage - 1)}>Previous</button>
                <span>{safePage} / {pageCount}</span>
                <button type="button" className="rounded-lg border border-slate-200 px-2 py-1 disabled:opacity-40" disabled={safePage >= pageCount} onClick={() => setPage(safePage + 1)}>Next</button>
                <select className="rounded-lg border border-slate-200 px-2 py-1" value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value)); setPage(1); }}>
                  {[10, 25, 50].map((size) => <option key={size} value={size}>{size} / page</option>)}
                </select>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap justify-end gap-2">
            <button type="button" className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 disabled:opacity-50" disabled={!visible.length} onClick={exportList}>Export List</button>
            <button type="button" className="rounded-xl border border-blue-200 bg-white px-4 py-2 text-sm font-semibold text-blue-700 disabled:opacity-50" disabled={problems || pending || loading} onClick={() => { setPreviewOpen(true); setReviewed(true); }}>Preview Changes</button>
            <button type="button" className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50" disabled={!reviewed || problems || pending || loading} onClick={() => setConfirmOpen(true)}>Confirm Promotion</button>
          </div>
        </>
      ) : null}

      {previewOpen && payload ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4">
          <section className="max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-3xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-slate-950">Preview changes</h3>
            <p className="mt-1 text-sm text-slate-500">{payload.scope.schoolName} · {payload.scope.levelLabel} Section {payload.scope.section} · {payload.scope.fromYear} → {payload.scope.toYear}</p>
            <p className="mt-3 text-sm text-slate-600">{chosen.length} {chosen.length === 1 ? "student" : "students"} selected. Nothing is saved until you confirm.</p>
            <div className="mt-4 overflow-x-auto">
              <PromotionReviewTable rows={chosen} fromYear={payload.scope.fromYear} toYear={payload.scope.toYear} />
            </div>
            {rows.length - chosen.length > 0 ? <p className="mt-4 text-sm text-slate-500">{rows.length - chosen.length} {rows.length - chosen.length === 1 ? "student stays" : "students stay"} in {payload.scope.levelLabel} Section {payload.scope.section}. They are not part of this confirmation.</p> : null}
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" className="rounded-xl border border-slate-200 px-4 py-2 text-sm" onClick={() => setPreviewOpen(false)}>Back to Review</button>
              <button type="button" className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white" onClick={() => { setPreviewOpen(false); setConfirmOpen(true); }}>Confirm Promotion</button>
            </div>
          </section>
        </div>
      ) : null}

      {confirmOpen && payload ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4">
          <section className="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl bg-white shadow-xl">
            <header className="flex items-start justify-between gap-3 border-b border-slate-100 px-6 py-5">
              <div className="flex items-start gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-blue-600 text-white"><Users className="h-5 w-5" /></span>
                <div>
                  <h3 className="text-lg font-semibold text-slate-950">Confirm promotion</h3>
                  <p className="mt-1 text-sm text-slate-500">{payload.scope.schoolName} · {payload.scope.levelLabel} · Section {payload.scope.section} · {payload.scope.fromYear}</p>
                </div>
              </div>
              <button type="button" className="rounded-lg px-2 py-1 text-sm text-slate-500 hover:bg-slate-100" onClick={() => setConfirmOpen(false)}>Close</button>
            </header>
            <div className="overflow-y-auto px-6 py-5">
              <p className="text-sm text-slate-600">{chosen.length} {chosen.length === 1 ? "student" : "students"} will be saved. Nothing changes until you confirm.</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <article className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3"><p className="text-xs font-medium text-emerald-700">Promote</p><p className="mt-1 text-2xl font-semibold text-emerald-950">{chosen.filter((row) => row.action === "PROMOTE").length}</p></article>
                <article className="rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3"><p className="text-xs font-medium text-amber-700">Repeat</p><p className="mt-1 text-2xl font-semibold text-amber-950">{chosen.filter((row) => row.action === "RETAIN").length}</p></article>
                <article className="rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3"><p className="text-xs font-medium text-rose-700">Alumni</p><p className="mt-1 text-2xl font-semibold text-rose-950">{chosen.filter((row) => row.action === "ALUMNI").length}</p></article>
              </div>
              <div className="mt-4 overflow-x-auto">
                <PromotionReviewTable rows={chosen} fromYear={payload.scope.fromYear} toYear={payload.scope.toYear} />
              </div>
              {rows.length - chosen.length > 0 ? <p className="mt-4 text-sm text-slate-500">{rows.length - chosen.length} {rows.length - chosen.length === 1 ? "student stays" : "students stay"} in {payload.scope.levelLabel} Section {payload.scope.section}. They are not part of this confirmation.</p> : null}
            </div>
            <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-6 py-4">
              <p className="text-xs text-slate-500">Please review the class, section, year, and destination before confirming.</p>
              <div className="flex gap-2">
                <button type="button" className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700" onClick={() => setConfirmOpen(false)}>Cancel</button>
                <button type="button" className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50" disabled={pending || !chosen.length} onClick={confirm}>{pending ? "Saving…" : "Confirm Promotion"}</button>
              </div>
            </footer>
          </section>
        </div>
      ) : null}

      {message ? <p className="rounded-xl bg-blue-50 px-4 py-3 text-sm text-blue-700">{message}</p> : null}
      {error ? <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p> : null}
    </div>
  );
}

function Metric({ label, value, detail, tone }: { label: string; value: number; detail: string; tone: string }) {
  return (
    <article className={`rounded-2xl border border-slate-200 p-4 shadow-sm ${tone}`}>
      <p className="text-xs font-medium uppercase tracking-wide">{label}</p>
      <p className="mt-2 text-3xl font-semibold">{value}</p>
      {detail ? <p className="mt-1 text-xs">{detail}</p> : null}
    </article>
  );
}

type HistoryRow = {
  id: string;
  permanentId: string;
  name: string;
  fromYear: string;
  fromClass: string;
  toYear: string;
  toClass: string;
  outcome: string;
  status: string;
  processedBy: string;
  processedAt: string;
};

export function PromotionHistoryPage() {
  const [rows, setRows] = useState<HistoryRow[]>([]);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    api<HistoryRow[]>(`/api/v1/promotions/history?q=${encodeURIComponent(query)}`)
      .then(setRows)
      .catch((caught: unknown) => setError(caught instanceof Error ? caught.message : "Could not load history."));
  }, [query]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold text-slate-950">Promotion History</h2>
          <p className="mt-1 text-sm text-slate-500">Completed section promotions. These records are not overwritten.</p>
        </div>
        <Link to="/school/promotion" className="text-sm font-medium text-blue-700">Back to promotion</Link>
      </div>
      <input className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm sm:max-w-xs" placeholder="Search student or outcome" value={query} onChange={(event) => setQuery(event.target.value)} />
      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full min-w-[860px] text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>{["Student", "From", "To", "Outcome", "Status", "Processed by", "Date"].map((heading) => <th key={heading} className="px-3 py-3 font-medium">{heading}</th>)}</tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-t border-slate-100">
                <td className="px-3 py-3"><span className="block font-medium text-slate-900">{row.name}</span><span className="text-xs text-slate-500">{row.permanentId}</span></td>
                <td className="px-3 py-3">{row.fromClass}<span className="block text-xs text-slate-500">{row.fromYear}</span></td>
                <td className="px-3 py-3">{row.toClass}<span className="block text-xs text-slate-500">{row.toYear}</span></td>
                <td className="px-3 py-3">{row.outcome}</td>
                <td className="px-3 py-3">{row.status}</td>
                <td className="px-3 py-3">{row.processedBy}</td>
                <td className="px-3 py-3">{new Date(row.processedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length ? <p className="px-4 py-8 text-center text-sm text-slate-500">No promotion history yet.</p> : null}
      </div>
      {error ? <p className="text-sm text-rose-600">{error}</p> : null}
    </div>
  );
}

type AlumniRow = {
  id: string;
  studentId: string;
  permanentId: string;
  secondaryPermanentId: string | null;
  name: string;
  gender: string;
  schoolName: string;
  stage: string;
  fromLevel: string;
  sectionName: string;
  yearName: string;
  term1Average: number | null;
  term2Average: number | null;
  combinedAverage: number | null;
  status: string;
  transferStatus: string;
  transferSchool: string | null;
  transferDate: string | null;
  transferReason: string | null;
  photoUrl: string | null;
  rollNumber: number | null;
  reason: string;
  completedAt: string;
  nextStage: string | null;
};

type AcademicHistoryRow = {
  id: string;
  yearName: string;
  schoolName: string;
  sameSchool: boolean;
  open: boolean;
  stage: string;
  level: string;
  section: string;
  status: string;
  startedOn: string | null;
  completedOn: string | null;
  attendance: { present: number; absent: number; late: number; excused: number; total: number } | null;
};

type AlumniProfile = {
  studentId: string;
  permanentId: string;
  secondaryPermanentId: string | null;
  viewer: "source" | "destination" | "home";
  caseStatus: string;
  continuation: string;
  name: string;
  firstName: string;
  fatherName: string;
  grandfatherName: string;
  phone: string | null;
  nationalId: string | null;
  dateOfBirth: string;
  photoUrl: string | null;
  startedAt: string | null;
  rollNumber: number | null;
  gender: string;
  status: string;
  guardians: Array<{ relationship: string; id: string; publicId: string; name: string; phone: string; email: string | null }>;
  attendance: { present: number; absent: number; late: number; excused: number; total: number };
  fees: { count: number; amount: number; paid: number; balance: number };
  transfer: { status: string; school: string; date: string; reason: string | null } | null;
  currentStatus: string;
  current: { schoolName: string; stage: string; level: string; section: string; yearName: string } | null;
  records: Array<{ id: string; schoolName: string; stage: string; fromLevel: string; yearName: string; yearStart: string; reason: string; completedAt: string; graduated: boolean; owned?: boolean }>;
  history: AcademicHistoryRow[];
  results: Array<{ yearName: string; term: string; subject: string; marks: number | null; maxMarks: number; absent: boolean }>;
  documents: Array<{ id: string; kind: string; title: string; status: string; createdAt: string }>;
};

function studentAge(dateOfBirth: string | null | undefined) {
  if (!dateOfBirth) return "—";
  const born = new Date(dateOfBirth);
  if (Number.isNaN(born.getTime())) return "—";
  const today = new Date();
  let age = today.getFullYear() - born.getFullYear();
  const month = today.getMonth() - born.getMonth();
  if (month < 0 || (month === 0 && today.getDate() < born.getDate())) age -= 1;
  return age >= 0 ? `${age}` : "—";
}

function subjectAverages(results: Array<{ subject: string; marks: number | null; maxMarks: number; absent: boolean }>) {
  const totals = new Map<string, { obtained: number; possible: number }>();
  for (const row of results) {
    if (row.absent || row.marks == null || row.maxMarks <= 0) continue;
    const bucket = totals.get(row.subject) ?? { obtained: 0, possible: 0 };
    bucket.obtained += row.marks;
    bucket.possible += row.maxMarks;
    totals.set(row.subject, bucket);
  }
  return [...totals.entries()].map(([name, value]) => ({ name, average: Math.round((value.obtained / value.possible) * 1000) / 10 }));
}

function journeyResult(level: string, status: string) {
  if (status === "Enrolled") return "Currently Studying";
  if (level === "Class 8" || level === "Form 4") return "Passed";
  if (status === "Completed") return "Promoted";
  return status;
}

function termAverage(results: Array<{ term: string; marks: number | null; maxMarks: number; absent: boolean }>, term: string | null) {
  const rows = results.filter((row) => (term ? row.term === term : true) && !row.absent && row.marks != null);
  const possible = rows.reduce((sum, row) => sum + row.maxMarks, 0);
  if (!possible) return "Incomplete";
  const obtained = rows.reduce((sum, row) => sum + (row.marks ?? 0), 0);
  return `${Math.round((obtained / possible) * 1000) / 10}%`;
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function initials(name: string) {
  return name.split(" ").filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "").join("");
}

function documentKind(kind: string) {
  return kind.toLowerCase().split("_").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
}

type FormSchool = { id: string; name: string; sameSchool: boolean; years: Array<{ id: string; name: string; startDate: string; sections: Array<{ id: string; name: string }> }> };

function formChoicesFor(schools: FormSchool[], completedStart: string) {
  const cutoff = completedStart.slice(0, 10);
  return schools
    .map((school) => ({
      ...school,
      years: school.years.filter((year) => year.sections.length && (!cutoff || year.startDate > cutoff)).sort((a, b) => a.startDate.localeCompare(b.startDate)),
    }))
    .filter((school) => school.years.length)
    .sort((a, b) => a.years[0].startDate.localeCompare(b.years[0].startDate) || a.name.localeCompare(b.name));
}

function historyClass(status: string) {
  if (status === "Rejected") return "bg-rose-50 text-rose-700";
  if (status === "In the queue" || status === "Transferred") return "bg-amber-50 text-amber-700";
  if (status === "Enrolled") return "bg-blue-50 text-blue-700";
  return "bg-emerald-50 text-emerald-700";
}

export function AlumniPage() {
  const [rows, setRows] = useState<AlumniRow[]>([]);
  const [query, setQuery] = useState("");
  const [stage, setStage] = useState("");
  const [yearFilter, setYearFilter] = useState("");
  const [classFilter, setClassFilter] = useState("");
  const [sectionFilter, setSectionFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [picked, setPicked] = useState<string[]>([]);
  const [transferOpen, setTransferOpen] = useState(false);
  const [schools, setSchools] = useState<FormSchool[]>([]);
  const [destSchoolId, setDestSchoolId] = useState("");
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState("");
  const [schoolType, setSchoolType] = useState<"PRIMARY_ONLY" | "SECONDARY_ONLY" | "PRIMARY_AND_SECONDARY" | "">("");
  const [error, setError] = useState("");

  useEffect(() => {
    api<AlumniRow[]>("/api/v1/alumni")
      .then(setRows)
      .catch((caught: unknown) => setError(caught instanceof Error ? caught.message : "Could not load alumni."));
    api<{ schoolType: "PRIMARY_ONLY" | "SECONDARY_ONLY" | "PRIMARY_AND_SECONDARY" }>("/api/v1/promotion/options")
      .then((data) => setSchoolType(data.schoolType))
      .catch(() => setSchoolType(""));
  }, []);

  useEffect(() => {
    if (!transferOpen) return;
    api<FormSchool[]>("/api/v1/alumni-form-1-options").then(setSchools).catch(() => setSchools([]));
  }, [transferOpen]);

  function resetTransfer() {
    setPicked([]);
    setTransferOpen(false);
  }

  async function sendAlumni() {
    if (!destSchoolId || !picked.length) return;
    setSending(true);
    setError("");
    setNotice("");
    try {
      for (const studentId of picked) {
        await api(`/api/v1/alumni/${studentId}/enroll-form-1`, { method: "POST", body: JSON.stringify({ toSchoolId: destSchoolId }) });
      }
      const count = picked.length;
      setNotice(count === 1
        ? "Request sent. The other school opens the student, checks the history, and chooses the section. A new ID and roll are created only after they accept."
        : `Request sent for ${count} alumni. The other school reviews each student and chooses the section. A new ID and roll are created only after they accept.`);
      resetTransfer();
      setRows(await api<AlumniRow[]>("/api/v1/alumni"));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not send the alumni transfer.");
      setRows(await api<AlumniRow[]>("/api/v1/alumni").catch(() => rows));
    } finally {
      setSending(false);
    }
  }

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return rows.filter((row) => {
      const allowedStage = schoolType === "PRIMARY_ONLY" ? row.stage === "Primary" : schoolType === "SECONDARY_ONLY" ? row.stage === "Secondary" : true;
      const matchesSearch = !needle || `${row.name} ${row.permanentId} ${row.schoolName}`.toLowerCase().includes(needle);
      return allowedStage && matchesSearch && (!stage || row.stage === stage) && (!yearFilter || row.yearName === yearFilter) && (!classFilter || row.fromLevel === classFilter) && (!sectionFilter || row.sectionName === sectionFilter) && (!statusFilter || row.status === statusFilter);
    }).sort((a, b) => a.fromLevel.localeCompare(b.fromLevel) || a.sectionName.localeCompare(b.sectionName) || a.name.localeCompare(b.name));
  }, [rows, query, stage, yearFilter, classFilter, sectionFilter, statusFilter, schoolType]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const pageRows = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);
  const yearOptions = [...new Set(rows.map((row) => row.yearName).filter(Boolean))];
  const classOptions = [...new Set(rows.filter((row) => schoolType === "PRIMARY_ONLY" ? row.stage === "Primary" : schoolType === "SECONDARY_ONLY" ? row.stage === "Secondary" : true).map((row) => row.fromLevel).filter(Boolean))];
  const sectionOptions = [...new Set(rows.filter((row) => !yearFilter || row.yearName === yearFilter).map((row) => row.sectionName).filter((name) => name && name !== "—"))];
  const sectionReady = Boolean(yearFilter && sectionFilter);
  const transferable = filtered.filter((row) => row.fromLevel === "Class 8" && row.transferStatus !== "Transferred" && row.transferStatus !== "Pending");
  const form4Only = sectionReady && filtered.length > 0 && filtered.every((row) => row.fromLevel === "Form 4");
  const allPicked = transferable.length > 0 && transferable.every((row) => picked.includes(row.studentId));
  const destinationSchools = useMemo(() => formChoicesFor(schools, ""), [schools]);
  useEffect(() => {
    if (destinationSchools.some((school) => school.id === destSchoolId)) return;
    setDestSchoolId(destinationSchools[0]?.id ?? "");
  }, [destinationSchools, destSchoolId]);
  const totalStudents = new Set(rows.map((row) => row.studentId)).size;
  const offersPrimary = schoolType ? schoolType !== "SECONDARY_ONLY" : rows.some((row) => row.stage === "Primary");
  const offersSecondary = schoolType ? schoolType !== "PRIMARY_ONLY" : rows.some((row) => row.stage === "Secondary");
  const stageOptions = [offersPrimary ? "Primary" : "", offersSecondary ? "Secondary" : ""].filter(Boolean);
  useEffect(() => {
    if (schoolType === "PRIMARY_ONLY" && stage === "Secondary") setStage("");
    if (schoolType === "SECONDARY_ONLY" && stage === "Primary") setStage("");
  }, [schoolType, stage]);
  const primaryGraduates = new Set(rows.filter((row) => row.stage === "Primary").map((row) => row.studentId)).size;
  const secondaryGraduates = new Set(rows.filter((row) => row.fromLevel === "Form 4").map((row) => row.studentId)).size;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-600 text-white"><GraduationCap className="h-5 w-5" /></span>
        <div>
          <h2 className="text-2xl font-semibold text-slate-950">Alumni</h2>
          <p className="mt-1 text-sm text-slate-500">Choose a year and section. The students in that section appear here. Then choose Transfer alumni student and the destination school.</p>
        </div>
      </div>
      <div className={`grid gap-3 ${offersPrimary && offersSecondary ? "md:grid-cols-3" : "md:grid-cols-2"}`}>
        <article className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-50 text-blue-700"><Users className="h-5 w-5" /></span>
          <div><p className="text-sm text-slate-500">Total Alumni</p><p className="text-2xl font-semibold text-slate-950">{totalStudents}</p><p className="text-xs text-slate-400">All recorded completions</p></div>
        </article>
        {offersPrimary ? (
          <article className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700"><GraduationCap className="h-5 w-5" /></span>
            <div><p className="text-sm text-slate-500">Primary Graduates</p><p className="text-2xl font-semibold text-slate-950">{primaryGraduates}</p><p className="text-xs text-slate-400">Completed Class 8</p></div>
          </article>
        ) : null}
        {offersSecondary ? (
          <article className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-50 text-blue-700"><GraduationCap className="h-5 w-5" /></span>
            <div><p className="text-sm text-slate-500">Secondary Graduates</p><p className="text-2xl font-semibold text-slate-950">{secondaryGraduates}</p><p className="text-xs text-slate-400">Completed Form 4</p></div>
          </article>
        ) : null}
      </div>
      <div className="grid gap-2 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm md:grid-cols-2 xl:grid-cols-4">
        <select className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" value={yearFilter} onChange={(event) => { setYearFilter(event.target.value); setPage(1); resetTransfer(); }}>
          <option value="">All years</option>
          {yearOptions.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
        {stageOptions.length > 1 ? (
          <select className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" value={stage} onChange={(event) => { setStage(event.target.value); setPage(1); resetTransfer(); }}>
            <option value="">All stages</option>
            {stageOptions.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        ) : null}
        <select className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" value={classFilter} onChange={(event) => { setClassFilter(event.target.value); setPage(1); resetTransfer(); }}>
          <option value="">{schoolType === "SECONDARY_ONLY" ? "All forms" : schoolType === "PRIMARY_ONLY" ? "All classes" : "All classes/forms"}</option>
          {classOptions.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
        <select className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" value={sectionFilter} onChange={(event) => { setSectionFilter(event.target.value); setPage(1); resetTransfer(); }}>
          <option value="">All sections</option>
          {sectionOptions.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
        <select className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); setPage(1); }}>
          <option value="">All statuses</option>
          <option value="Graduated">Graduated</option>
        </select>
        <input className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" placeholder="Search by name, ID, or school" value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} />
      </div>
      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full min-w-[980px] text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              {sectionReady ? <th className="px-3 py-3"><input type="checkbox" aria-label="Select every alumni student in this section" className="h-4 w-4 accent-blue-600" checked={allPicked} disabled={!transferable.length} onChange={() => setPicked(allPicked ? [] : transferable.map((row) => row.studentId))} /></th> : null}
              {["#", "Student", "Completed", "Section", "Term 1", "Term 2", "Average", "Status", ""].map((heading) => <th key={heading || "action"} className="px-3 py-3 font-medium">{heading}</th>)}
            </tr>
          </thead>
          <tbody>
            {pageRows.map((row, index) => {
              const showSection = index === 0 || pageRows[index - 1]?.sectionName !== row.sectionName || pageRows[index - 1]?.fromLevel !== row.fromLevel;
              const canTransfer = transferable.some((item) => item.studentId === row.studentId);
              const selected = picked.includes(row.studentId);
              return (
              <Fragment key={row.id}>
              {showSection ? <tr key={`${row.sectionName}-${row.fromLevel}-head`} className="border-t border-slate-200 bg-slate-50"><td className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500" colSpan={sectionReady ? 10 : 9}>{row.fromLevel} · Section {row.sectionName}</td></tr> : null}
              <tr key={row.id} className={`border-t border-slate-100 hover:bg-slate-50 ${selected ? "bg-blue-50/60" : ""}`}>
                {sectionReady ? <td className="px-3 py-3">{canTransfer ? <input type="checkbox" aria-label={`Select ${row.name}`} className="h-4 w-4 accent-blue-600" checked={selected} onChange={() => setPicked((current) => selected ? current.filter((id) => id !== row.studentId) : [...current, row.studentId])} /> : null}</td> : null}
                <td className="px-3 py-3 text-slate-400">{(safePage - 1) * pageSize + index + 1}</td>
                <td className="px-3 py-3">
                  <div className="flex items-center gap-3">
                    <span className="grid h-9 w-9 place-items-center rounded-full bg-blue-600 text-xs font-semibold text-white">{initials(row.name)}</span>
                    <span>
                      <span className="block font-semibold text-slate-900">{row.name}</span>
                      <span className="text-xs text-slate-500">{row.permanentId}{row.secondaryPermanentId ? ` · ${row.secondaryPermanentId}` : ""}</span>
                    </span>
                  </div>
                </td>
                <td className="px-3 py-3 font-semibold text-slate-900">{row.fromLevel}</td>
                <td className="px-3 py-3 font-medium text-slate-800">Section {row.sectionName}</td>
                <td className="px-3 py-3">{row.term1Average == null ? "Incomplete" : `${row.term1Average}%`}</td>
                <td className="px-3 py-3">{row.term2Average == null ? "Incomplete" : `${row.term2Average}%`}</td>
                <td className="px-3 py-3 font-semibold">{row.combinedAverage == null ? "—" : `${row.combinedAverage}%`}</td>
                <td className="px-3 py-3">
                  <span className={`rounded-full px-2 py-1 text-xs font-semibold ${row.transferStatus === "Transferred" ? "bg-blue-50 text-blue-700" : row.transferStatus === "Pending" ? "bg-amber-50 text-amber-700" : row.transferStatus === "Rejected" ? "bg-rose-50 text-rose-700" : "bg-slate-100 text-slate-600"}`}>{row.transferStatus === "Transferred" ? "Enrolled" : row.transferStatus === "Pending" ? "In the queue" : row.transferStatus}</span>
                  {row.transferStatus === "Transferred" && row.transferSchool ? <span className="mt-1 block text-xs text-slate-500">{row.transferSchool}{row.transferDate ? ` · ${formatDate(row.transferDate)}` : ""}</span> : row.transferStatus === "Rejected" && row.transferReason ? <span className="mt-1 block text-xs text-slate-500">{row.transferReason}</span> : null}
                </td>
                <td className="px-3 py-3"><Link className="rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700" to={`/school/alumni/${row.studentId}`}>View</Link></td>
              </tr>
              </Fragment>
              );
            })}
          </tbody>
        </table>
        {!filtered.length ? <p className="px-4 py-8 text-center text-sm text-slate-500">No alumni records yet.</p> : null}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-4 py-3 text-sm text-slate-500">
          <span>{filtered.length ? `Showing ${(safePage - 1) * pageSize + 1}–${Math.min(safePage * pageSize, filtered.length)} of ${filtered.length} alumni` : "Showing 0 alumni"}</span>
          <div className="flex items-center gap-2">
            <button type="button" className="rounded-lg border border-slate-200 px-2 py-1 disabled:opacity-40" disabled={safePage <= 1} onClick={() => setPage(safePage - 1)}>Previous</button>
            <span>{safePage} / {pageCount}</span>
            <button type="button" className="rounded-lg border border-slate-200 px-2 py-1 disabled:opacity-40" disabled={safePage >= pageCount} onClick={() => setPage(safePage + 1)}>Next</button>
            <select className="rounded-lg border border-slate-200 px-2 py-1" value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value)); setPage(1); }}>
              {[10, 25, 50].map((size) => <option key={size} value={size}>{size} / page</option>)}
            </select>
          </div>
        </div>
      </div>
      {notice ? <p className="rounded-xl bg-blue-50 px-4 py-3 text-sm text-blue-700">{notice}</p> : null}
      {error ? <p className="text-sm text-rose-600">{error}</p> : null}
      {sectionReady ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          {form4Only || schoolType === "SECONDARY_ONLY" ? (
            <p className="text-sm text-slate-600">Form 4 alumni stay alumni. There is no Form 5, so this section is not sent to another school from here.</p>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="font-semibold text-slate-950">Transfer alumni student</h3>
                  <p className="mt-1 text-sm text-slate-500">{transferable.length ? `${picked.length} of ${transferable.length} Class 8 alumni selected. Choose one student, several, or the whole section.` : "Every Class 8 student in this section already has a transfer, or none are waiting here."}</p>
                </div>
                <button type="button" className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40" disabled={!picked.length} onClick={() => setTransferOpen(true)}>Transfer alumni student</button>
              </div>
              {transferOpen ? (
                <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-4">
                  <label className="block text-sm font-medium text-slate-700">Destination school
                    <select className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5" value={destSchoolId} onChange={(event) => setDestSchoolId(event.target.value)}>
                      {destinationSchools.map((school) => <option key={school.id} value={school.id}>{school.name}</option>)}
                    </select>
                  </label>
                  <p className="mt-2 text-sm text-slate-500">The other school opens the student, checks the history, and chooses the Form 1 section. A new ID and roll are created only after they accept.</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button type="button" className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40" disabled={sending || !destSchoolId} onClick={() => void sendAlumni()}>{sending ? "Sending..." : picked.length === 1 ? "Send this student" : `Send ${picked.length} students`}</button>
                    <button type="button" className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700" onClick={() => setTransferOpen(false)}>Close</button>
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </section>
      ) : (
        <p className="rounded-2xl border border-slate-200 bg-white px-5 py-4 text-sm text-slate-500 shadow-sm">To transfer alumni, choose the year and the section. The list appears, then Transfer alumni student, then the destination school.</p>
      )}
    </div>
  );
}

export function AlumniProfilePage() {
  const { studentId } = useParams();
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({ firstName: "", fatherName: "", grandfatherName: "", phone: "", nationalId: "", gender: "MALE", dateOfBirth: "" });
  const [profile, setProfile] = useState<AlumniProfile | null>(null);
  const [selectedRecordId, setSelectedRecordId] = useState("");
  const [tab, setTab] = useState<"overview" | "history" | "documents">("overview");
  const [formSchools, setFormSchools] = useState<FormSchool[]>([]);
  const [toSchoolId, setToSchoolId] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!studentId) return;
    api<AlumniProfile>(`/api/v1/alumni/${studentId}`)
      .then((data) => {
        setProfile(data);
        setSelectedRecordId(data.records[0]?.id ?? "");
        setEditForm({
          firstName: data.firstName,
          fatherName: data.fatherName,
          grandfatherName: data.grandfatherName,
          phone: data.phone ?? "",
          nationalId: data.nationalId ?? "",
          gender: data.gender === "Female" ? "FEMALE" : "MALE",
          dateOfBirth: data.dateOfBirth.slice(0, 10),
        });
      })
      .catch((caught: unknown) => setError(caught instanceof Error ? caught.message : "Could not open the alumni profile."));
    api<FormSchool[]>("/api/v1/alumni-form-1-options").then(setFormSchools).catch(() => setFormSchools([]));
  }, [studentId]);

  const completedStart = profile?.records.find((row) => row.owned !== false && row.fromLevel === "Class 8")?.yearStart
    ?? profile?.records.find((row) => row.fromLevel === "Class 8")?.yearStart
    ?? "";
  const formChoices = useMemo(() => formChoicesFor(formSchools, completedStart), [formSchools, completedStart]);

  useEffect(() => {
    if (!profile) return;
    if (formChoices.some((item) => item.id === toSchoolId)) return;
    setToSchoolId(formChoices[0]?.id ?? "");
  }, [profile, formChoices, toSchoolId]);

  const selectedRecord = profile?.records.find((record) => record.id === selectedRecordId) ?? profile?.records[0];
  const attendanceRows = profile?.history.filter((row) => row.open && row.attendance) ?? [];

  async function continueForm1(id: string) {
    setError("");
    try {
      await api(`/api/v1/alumni/${id}/enroll-form-1`, { method: "POST", body: JSON.stringify({ toSchoolId }) });
      setMessage("Request sent. The other school opens the student, checks the history, and chooses the section. A new ID and roll are created only after they accept.");
      setProfile(await api<AlumniProfile>(`/api/v1/alumni/${id}`));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not enroll into Form 1.");
    }
  }

  if (!profile) return <p className="text-slate-500">{error || "Loading student..."}</p>;

  const journey = [...profile.history];
  if (profile.viewer === "source" && !profile.history.some((row) => !row.sameSchool) && profile.caseStatus !== "Still alumni" && profile.caseStatus !== "Continued here") {
    journey.push({
      id: "transfer-case",
      yearName: "—",
      schoolName: profile.transfer?.school || profile.current?.schoolName || "—",
      sameSchool: false,
      open: false,
      stage: "Secondary",
      level: "",
      section: "",
      status: profile.caseStatus,
      startedOn: null,
      completedOn: null,
      attendance: null,
    });
  }

  return (
    <div className="space-y-4">
      <Link to="/school/alumni" className="text-sm font-semibold text-blue-700">Back to alumni</Link>
      {message ? <p className="rounded-xl bg-blue-50 px-4 py-3 text-sm text-blue-700">{message}</p> : null}
      {error ? <p className="text-sm text-rose-600">{error}</p> : null}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
              <div className="flex items-center gap-3">
                {profile.photoUrl ? <img src={profile.photoUrl} alt="" className="h-14 w-14 rounded-full object-cover" /> : <span className="flex h-14 w-14 items-center justify-center rounded-full bg-blue-600 text-sm font-semibold text-white">{initials(profile.name)}</span>}
                <div>
                  <h3 className="text-lg font-semibold text-slate-950">{profile.name}</h3>
                  <p className="text-sm text-slate-500">{profile.permanentId}{profile.secondaryPermanentId ? ` · Secondary ${profile.secondaryPermanentId}` : ""} · {profile.gender}</p>
                  <p className="mt-1 flex flex-wrap items-center gap-2 text-sm font-medium text-slate-700">
                    <span>{profile.continuation}</span>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${historyClass(profile.caseStatus)}`}>{profile.caseStatus}</span>
                  </p>
                </div>
              </div>
              <Link to="/school/alumni" className="shrink-0 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700">Back to alumni</Link>
            </div>
            <div className="flex gap-2 border-b border-slate-100 px-5">
              {([["overview", "Overview"], ["history", "Academic History"], ["documents", "Documents"]] as const).map(([key, label]) => (
                <button key={key} type="button" className={`border-b-2 px-3 py-3 text-sm font-medium ${tab === key ? "border-blue-600 text-blue-700" : "border-transparent text-slate-500"}`} onClick={() => setTab(key)}>{label}</button>
              ))}
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4">
              {tab === "overview" ? (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className={`inline-flex rounded-full px-3 py-1 text-sm font-medium ${historyClass(profile.viewer === "source" ? profile.caseStatus : profile.currentStatus)}`}>{profile.viewer === "source" ? profile.caseStatus : profile.currentStatus}</p>
                    <button type="button" className="rounded-xl bg-blue-600 px-3 py-2 text-sm font-semibold text-white" onClick={() => setEditing((value) => !value)}>{editing ? "Close edit" : "Edit student"}</button>
                  </div>
                  {editing ? (
                    <form className="grid gap-3 rounded-xl border border-slate-200 p-4 sm:grid-cols-2" onSubmit={(event) => {
                      event.preventDefault();
                      api(`/api/v1/students/${profile.studentId}`, { method: "PATCH", body: JSON.stringify(editForm) })
                        .then(async () => {
                          setEditing(false);
                          setMessage("Student details updated.");
                          const data = await api<AlumniProfile>(`/api/v1/alumni/${profile.studentId}`);
                          setProfile(data);
                        })
                        .catch((caught: unknown) => setError(caught instanceof Error ? caught.message : "Could not update the student."));
                    }}>
                      <label className="text-sm text-slate-600">First name<input className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" value={editForm.firstName} onChange={(event) => setEditForm({ ...editForm, firstName: event.target.value })} required /></label>
                      <label className="text-sm text-slate-600">Father name<input className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" value={editForm.fatherName} onChange={(event) => setEditForm({ ...editForm, fatherName: event.target.value })} required /></label>
                      <label className="text-sm text-slate-600">Grandfather name<input className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" value={editForm.grandfatherName} onChange={(event) => setEditForm({ ...editForm, grandfatherName: event.target.value })} required /></label>
                      <label className="text-sm text-slate-600">Phone<input className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" value={editForm.phone} onChange={(event) => setEditForm({ ...editForm, phone: event.target.value })} /></label>
                      <label className="text-sm text-slate-600">Date of birth<input className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" type="date" value={editForm.dateOfBirth} onChange={(event) => setEditForm({ ...editForm, dateOfBirth: event.target.value })} required /></label>
                      <label className="text-sm text-slate-600">NIRA<input className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" value={editForm.nationalId} onChange={(event) => setEditForm({ ...editForm, nationalId: event.target.value })} /></label>
                      <div className="sm:col-span-2"><button className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white">Save</button></div>
                    </form>
                  ) : null}
                  <dl className="grid gap-3 text-sm sm:grid-cols-2">
                    <div><dt className="text-slate-500">Student ID</dt><dd className="font-medium text-slate-900">{profile.permanentId}</dd></div>
                    {profile.secondaryPermanentId ? <div><dt className="text-slate-500">Secondary ID</dt><dd className="font-medium text-slate-900">{profile.secondaryPermanentId}</dd></div> : null}
                    <div><dt className="text-slate-500">Age</dt><dd className="font-medium text-slate-900">{studentAge(profile.dateOfBirth)}</dd></div>
                    <div><dt className="text-slate-500">Roll</dt><dd className="font-medium text-slate-900">{profile.rollNumber ?? "—"}</dd></div>
                    <div><dt className="text-slate-500">Started school</dt><dd className="font-medium text-slate-900">{formatDate(profile.startedAt)}</dd></div>
                    <div><dt className="text-slate-500">Final class</dt><dd className="font-medium text-slate-900">{selectedRecord?.fromLevel ?? "—"} · {selectedRecord?.yearName || "—"}</dd></div>
                    <div><dt className="text-slate-500">Completion school</dt><dd className="font-medium text-slate-900">{selectedRecord?.schoolName || "—"}</dd></div>
                    <div><dt className="text-slate-500">Completion date</dt><dd className="font-medium text-slate-900">{formatDate(selectedRecord?.completedAt)}</dd></div>
                  </dl>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <article className="rounded-xl border border-blue-100 bg-blue-50 p-3"><p className="text-xs text-blue-700">Term 1</p><p className="mt-1 text-xl font-semibold text-blue-900">{termAverage(profile.results, "Term 1")}</p></article>
                    <article className="rounded-xl border border-violet-100 bg-violet-50 p-3"><p className="text-xs text-violet-700">Term 2</p><p className="mt-1 text-xl font-semibold text-violet-900">{termAverage(profile.results, "Term 2")}</p></article>
                    <article className="rounded-xl border border-emerald-100 bg-emerald-50 p-3"><p className="text-xs text-emerald-700">Combined</p><p className="mt-1 text-xl font-semibold text-emerald-900">{termAverage(profile.results, null)}</p></article>
                  </div>
                  <article className="rounded-xl border border-slate-200 p-4">
                    <h4 className="text-sm font-semibold text-slate-900">Attendance</h4>
                    <p className="mt-2 text-sm text-slate-600">{profile.attendance.total ? `${profile.attendance.present} present · ${profile.attendance.absent} absent · ${profile.attendance.late} late · ${profile.attendance.excused} excused · ${Math.round((profile.attendance.present / profile.attendance.total) * 100)}%` : "No attendance is recorded."}</p>
                  </article>
                  <article className="rounded-xl border border-slate-200 p-4">
                    <h4 className="text-sm font-semibold text-slate-900">Parents</h4>
                    {profile.guardians.length ? profile.guardians.map((guardian) => (
                      <p key={guardian.id} className="mt-2 text-sm text-slate-700">{guardian.name} · {guardian.relationship} · {guardian.publicId} · {guardian.phone}</p>
                    )) : <p className="mt-2 text-sm text-slate-500">No parent is linked.</p>}
                  </article>
                  <article className="rounded-xl border border-slate-200 p-4">
                    <h4 className="text-sm font-semibold text-slate-900">Fees</h4>
                    <p className="mt-2 text-sm text-slate-600">{profile.fees.count ? `${profile.fees.count} fee(s) · charged ${profile.fees.amount} · paid ${profile.fees.paid} · balance ${profile.fees.balance}` : "No fees are recorded."}</p>
                  </article>
                  <article className="rounded-xl border border-slate-200 p-4">
                    <h4 className="text-sm font-semibold text-slate-900">Transfer</h4>
                    {profile.caseStatus === "In the queue" ? (
                      <p className="mt-2 text-sm text-slate-700">Still in the queue for {profile.transfer?.school || "the other school"}.</p>
                    ) : profile.caseStatus === "Rejected" ? (
                      <p className="mt-2 text-sm text-slate-700">Rejected by {profile.transfer?.school || "the other school"}{profile.transfer?.reason ? ` · ${profile.transfer.reason}` : ""}.</p>
                    ) : profile.caseStatus === "Enrolled" && profile.viewer === "source" ? (
                      <p className="mt-2 text-sm text-slate-700">Transferred to {profile.transfer?.school || profile.current?.schoolName}. Accepted.</p>
                    ) : profile.viewer === "destination" && profile.continuation.startsWith("Added to section") ? (
                      <p className="mt-2 text-sm text-slate-700">{profile.continuation}. Primary ID {profile.permanentId}.</p>
                    ) : profile.transfer && profile.transfer.status !== "REJECTED" ? (
                      <p className="mt-2 text-sm text-slate-700">{profile.caseStatus} · {profile.transfer.school}</p>
                    ) : <p className="mt-2 text-sm text-slate-500">Not transferred.</p>}
                  </article>
                </div>
              ) : null}
              {tab === "history" ? (
                <div className="space-y-5">
                  <div>
                    <h4 className="text-sm font-semibold text-slate-800">Academic History</h4>
                    <p className="mt-1 text-xs text-slate-500">The classes this student passed through, and the school they were transferred to.</p>
                  </div>
                  <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                    <table className="w-full min-w-[720px] text-left text-sm">
                      <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                        <tr>{["#", "Academic year", "School", "Stage", "Class/Form", "Section", "Status"].map((heading) => <th key={heading} className="px-3 py-2 font-medium">{heading}</th>)}</tr>
                      </thead>
                      <tbody>
                        {journey.map((row, index) => (
                          <tr key={row.id} className="border-t border-slate-100">
                            <td className="px-3 py-2 text-slate-400">{index + 1}</td>
                            <td className="px-3 py-2">{row.yearName || "—"}</td>
                            <td className="px-3 py-2">{row.schoolName}</td>
                            <td className="px-3 py-2">{row.stage || "—"}</td>
                            <td className="px-3 py-2">{row.open ? row.level : "—"}</td>
                            <td className="px-3 py-2">{row.open ? row.section : "—"}</td>
                            <td className="px-3 py-2"><span className={`rounded-full px-2 py-1 text-xs font-medium ${historyClass(row.status)}`}>{row.status}</span></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {!journey.length ? <p className="px-4 py-3 text-sm text-slate-500">No enrollment history is recorded for this student.</p> : null}
                  </div>
                  <div className="relative ml-3 space-y-4 border-l border-slate-200 pl-6">
                    {journey.map((row, index) => {
                      if (!row.open) {
                        return (
                          <div key={row.id} className="relative">
                            <span className="absolute -left-[38px] grid h-7 w-7 place-items-center rounded-full bg-violet-600 text-xs font-semibold text-white">{index + 1}</span>
                            <article className="rounded-2xl border border-violet-100 bg-violet-50/50 p-4 shadow-sm">
                              <div className="flex flex-wrap items-start justify-between gap-3">
                                <div>
                                  <h5 className="font-semibold text-slate-950">{row.schoolName}</h5>
                                  <p className="mt-1 text-sm text-slate-500">{row.yearName && row.yearName !== "—" ? `Academic year: ${row.yearName}` : "Waiting on the other school"}</p>
                                </div>
                                <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${historyClass(row.status)}`}>{row.status}</span>
                              </div>
                              <p className="mt-3 text-sm text-slate-600">{row.status === "Enrolled" ? "Accepted." : row.status === "Rejected" ? "Rejected." : "Still in the queue."}</p>
                            </article>
                          </div>
                        );
                      }
                      const yearResults = profile.results.filter((item) => item.yearName === row.yearName);
                      const averages = subjectAverages(yearResults);
                      return (
                        <div key={row.id} className="relative">
                          <span className="absolute -left-[38px] grid h-7 w-7 place-items-center rounded-full bg-blue-600 text-xs font-semibold text-white">{index + 1}</span>
                          <article className={`rounded-2xl border p-4 shadow-sm ${row.stage === "Secondary" ? "border-violet-100 bg-violet-50/40" : "border-slate-200 bg-white"}`}>
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div>
                                <div className="flex flex-wrap items-center gap-2">
                                  <h5 className="font-semibold text-slate-950">{row.schoolName}</h5>
                                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${row.stage === "Secondary" ? "bg-violet-100 text-violet-700" : "bg-blue-50 text-blue-700"}`}>{row.stage}</span>
                                </div>
                                <p className="mt-1 text-sm text-slate-500">Academic year: {row.yearName}</p>
                              </div>
                              <div className="text-right">
                                <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${historyClass(row.status)}`}>{row.status}</span>
                                <p className="mt-1 text-xs text-slate-400">{row.status === "Completed" && row.completedOn ? `Completed on ${formatDate(row.completedOn)}` : row.startedOn ? `Enrolled on ${formatDate(row.startedOn)}` : ""}</p>
                              </div>
                            </div>
                            <div className="mt-3 grid gap-2 text-sm sm:grid-cols-4">
                              <div className="rounded-xl bg-white px-3 py-2"><p className="text-xs text-slate-400">Class / Form</p><p className="font-semibold text-slate-900">{row.level}</p></div>
                              <div className="rounded-xl bg-white px-3 py-2"><p className="text-xs text-slate-400">Section</p><p className="font-semibold text-slate-900">{row.section}</p></div>
                              <div className="rounded-xl bg-white px-3 py-2"><p className="text-xs text-slate-400">Completed stage</p><p className="font-semibold text-slate-900">{row.stage}</p></div>
                              <div className="rounded-xl bg-white px-3 py-2"><p className="text-xs text-slate-400">{row.status === "Enrolled" ? "Status" : "Final result"}</p><p className="font-semibold text-slate-900">{journeyResult(row.level, row.status)}</p></div>
                            </div>
                            <p className="mt-3 text-sm font-medium text-slate-800">{averages.length ? averages.map((item) => `${item.name} ${item.average}%`).join(" · ") : "No published subject average."}</p>
                            <div className="mt-4 grid gap-3 md:grid-cols-2">
                              {(["Term 1", "Term 2"] as const).map((term) => {
                                const subjects = yearResults.filter((item) => item.term === term);
                                return (
                                  <article key={term} className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
                                    <div className="flex items-center justify-between gap-2">
                                      <h6 className="font-semibold text-slate-900">{term}</h6>
                                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${subjects.length ? "bg-emerald-50 text-emerald-700" : "bg-slate-200 text-slate-600"}`}>{subjects.length ? "Published" : "Incomplete"}</span>
                                    </div>
                                    {subjects.length ? (
                                      <table className="mt-3 w-full text-left text-sm">
                                        <thead>
                                          <tr className="border-b border-slate-200 text-xs text-slate-500">
                                            <th className="py-2 font-medium">Subject</th>
                                            <th className="py-2 text-right font-medium">Marks</th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {subjects.map((subject) => (
                                            <tr key={subject.subject} className="border-b border-slate-100 last:border-0">
                                              <td className="py-2.5 text-slate-800">{subject.subject}</td>
                                              <td className="py-2.5 text-right font-medium text-slate-900">{subject.absent ? "Absent" : subject.marks == null ? "—" : `${subject.marks} / ${subject.maxMarks}`}</td>
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    ) : <p className="mt-3 text-sm text-slate-500">Not published.</p>}
                                    <p className="mt-3 border-t border-slate-200 pt-2 text-sm font-semibold text-slate-900">Term average {termAverage(yearResults, term)}</p>
                                  </article>
                                );
                              })}
                            </div>
                            <p className="mt-3 rounded-xl bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800">Average of Term 1 and Term 2: {termAverage(yearResults, null)}</p>
                          </article>
                        </div>
                      );
                    })}
                  </div>
                  <article className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <h4 className="font-semibold text-slate-950">Current student status</h4>
                    {profile.viewer === "source" ? (
                      <p className="mt-1 text-sm text-slate-500">{profile.caseStatus === "In the queue" ? `Still in the queue for ${profile.transfer?.school || "the other school"}.` : profile.caseStatus === "Rejected" ? `Rejected by ${profile.transfer?.school || "the other school"}.` : `Transferred to ${profile.current?.schoolName || profile.transfer?.school || "the other school"}.`}</p>
                    ) : profile.viewer === "destination" ? (
                      <p className="mt-1 text-sm text-slate-500">{profile.continuation}.</p>
                    ) : profile.current && profile.current.schoolName === (selectedRecord?.schoolName ?? "") ? (
                      <p className="mt-1 text-sm text-slate-500">This student continued at this school.</p>
                    ) : profile.caseStatus === "In the queue" ? (
                      <p className="mt-1 text-sm text-slate-500">This student is still in the queue for {profile.transfer?.school}.</p>
                    ) : profile.caseStatus === "Rejected" ? (
                      <p className="mt-1 text-sm text-slate-500">This request was rejected.</p>
                    ) : <p className="mt-1 text-sm text-slate-500">This student is still alumni.</p>}
                    <div className="mt-3 grid gap-2 text-sm sm:grid-cols-4">
                      <div className="rounded-xl bg-white px-3 py-2"><p className="text-xs text-slate-400">Current status</p><p className={`font-semibold ${profile.caseStatus === "Rejected" ? "text-rose-700" : profile.caseStatus === "In the queue" ? "text-amber-700" : "text-violet-700"}`}>{profile.caseStatus}</p></div>
                      <div className="rounded-xl bg-white px-3 py-2"><p className="text-xs text-slate-400">Current school</p><p className="font-semibold text-slate-900">{profile.viewer === "source" ? (profile.current?.schoolName || profile.transfer?.school || "—") : (profile.current?.schoolName || selectedRecord?.schoolName || "—")}</p></div>
                      <div className="rounded-xl bg-white px-3 py-2"><p className="text-xs text-slate-400">Current class</p><p className="font-semibold text-slate-900">{profile.viewer === "source" || !profile.current?.level ? "—" : `${profile.current.level}${profile.current.section ? ` - ${profile.current.section}` : ""}`}</p></div>
                      <div className="rounded-xl bg-white px-3 py-2"><p className="text-xs text-slate-400">{profile.viewer === "destination" ? "Section" : "Enrollment date"}</p><p className="font-semibold text-slate-900">{profile.viewer === "source" ? "—" : profile.viewer === "destination" ? (profile.current?.section || "—") : formatDate(profile.history.find((row) => row.open && !row.sameSchool)?.startedOn || profile.transfer?.date)}</p></div>
                    </div>
                  </article>
                  <div>
                    <h4 className="text-sm font-semibold text-slate-800">Attendance</h4>
                    {attendanceRows.length ? (
                      <div className="mt-2 overflow-x-auto rounded-xl border border-slate-200">
                        <table className="w-full text-left text-sm">
                          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                            <tr>{["Academic Year", "Class/Form", "Present", "Absent", "Late", "Excused"].map((heading) => <th key={heading} className="px-3 py-2 font-medium">{heading}</th>)}</tr>
                          </thead>
                          <tbody>
                            {attendanceRows.map((row) => (
                              <tr key={row.id} className="border-t border-slate-100">
                                <td className="px-3 py-2">{row.yearName}</td>
                                <td className="px-3 py-2">{row.level}</td>
                                <td className="px-3 py-2">{row.attendance?.present}</td>
                                <td className="px-3 py-2">{row.attendance?.absent}</td>
                                <td className="px-3 py-2">{row.attendance?.late}</td>
                                <td className="px-3 py-2">{row.attendance?.excused}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : <p className="mt-2 text-sm text-slate-500">No attendance is recorded for this student.</p>}
                  </div>
                </div>
              ) : null}
              {tab === "documents" ? (
                <div>
                  <h4 className="text-sm font-semibold text-slate-800">Documents</h4>
                  {profile.documents.length ? (
                    <div className="mt-3 space-y-2">
                      {profile.documents.map((document) => (
                        <div key={document.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 px-3 py-3 text-sm">
                          <div>
                            <p className="font-medium text-slate-900">{document.title}</p>
                            <p className="text-xs text-slate-500">{documentKind(document.kind)} · {document.status} · {formatDate(document.createdAt)}</p>
                          </div>
                          {document.status === "VERIFIED" ? <a className="rounded-xl bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-500" href={`/api/v1/documents/${document.id}/download`}>Download</a> : null}
                        </div>
                      ))}
                    </div>
                  ) : <p className="mt-2 text-sm text-slate-500">No documents are stored for this student at this school.</p>}
                </div>
              ) : null}
            </div>
            {profile.status === "ALUMNI" && profile.currentStatus === "Primary Graduate" && !profile.history.some((row) => row.stage === "Secondary") && profile.transfer?.status !== "PENDING" && profile.transfer?.status !== "COMPLETED" ? (
              <div className="space-y-3 border-t border-slate-100 bg-blue-50 px-5 py-4">
                <h4 className="text-sm font-semibold text-slate-900">Transfer to Form 1</h4>
                <p className="text-xs text-slate-600">Choose the secondary school. That school opens the student, checks the academic history, and chooses the section. A new ID and roll are created only after they accept.</p>
                {formChoices.length ? (
                  <div className="flex flex-wrap items-end gap-2">
                    <label className="text-xs text-slate-500">School
                      <select className="mt-1 block min-w-64 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" value={toSchoolId} onChange={(event) => setToSchoolId(event.target.value)}>
                        {formChoices.map((item) => <option key={item.id} value={item.id}>{item.name}{item.sameSchool ? " · this school" : ""}</option>)}
                      </select>
                    </label>
                    <button type="button" className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white" onClick={() => continueForm1(profile.studentId)}>Send transfer request</button>
                  </div>
                ) : <p className="text-sm text-amber-800">No secondary school has a Form 1 section yet. Create Form 1 in a later year, then open this student again.</p>}
              </div>
            ) : null}
      </div>
    </div>
  );
}
