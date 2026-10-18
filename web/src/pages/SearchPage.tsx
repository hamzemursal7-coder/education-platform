import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../lib/api";

type SearchResult = {
  students: Array<{ id: string; permanentId: string; name: string; year: string; level: string; section: string }>;
  teachers: Array<{ id: string; publicId: string; name: string; email: string }>;
  staff: Array<{ id: string; publicId: string; name: string; role: string; designation: string }>;
};

export function SearchPage() {
  const [params] = useSearchParams();
  const [query, setQuery] = useState(params.get("q") ?? "");
  const [result, setResult] = useState<SearchResult>({ students: [], teachers: [], staff: [] });
  const [error, setError] = useState("");

  useEffect(() => {
    if (query.trim().length < 2) {
      setResult({ students: [], teachers: [], staff: [] });
      return;
    }
    const handle = setTimeout(() => {
      api<SearchResult>(`/api/v1/search?q=${encodeURIComponent(query.trim())}`)
        .then(setResult)
        .catch((caught: unknown) => setError(caught instanceof Error ? caught.message : "Search failed."));
    }, 250);
    return () => clearTimeout(handle);
  }, [query]);

  return (
    <div className="space-y-6">
      <input
        className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-800 shadow-sm placeholder:text-slate-400"
        placeholder="Search student ID, name, guardian phone, teacher, staff..."
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />
      {error ? <p className="text-red-600">{error}</p> : null}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">Students</h2>
        {result.students.map((student) => (
          <Link key={student.id} to={`/school/students/${student.id}`} className="block rounded-xl border border-slate-200 bg-white p-4 text-slate-800 shadow-sm hover:border-blue-200">
            <p className="font-semibold text-blue-600">{student.name}</p>
            <p className="text-sm text-slate-500">{student.permanentId} · {student.year} · {student.level} {student.section}</p>
          </Link>
        ))}
        {!result.students.length && query.trim().length >= 2 ? <p className="text-slate-500">No students matched.</p> : null}
      </section>
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">Teachers</h2>
        {result.teachers.map((teacher) => (
          <article key={teacher.id} className="rounded-xl border border-slate-200 bg-white p-4 text-slate-800 shadow-sm">
            <p className="font-semibold">{teacher.name} · {teacher.publicId}</p>
            <p className="text-sm text-slate-500">{teacher.email}</p>
          </article>
        ))}
      </section>
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">Staff</h2>
        {result.staff.map((row) => (
          <article key={row.id} className="rounded-xl border border-slate-200 bg-white p-4 text-slate-800 shadow-sm">
            <p className="font-semibold">{row.name} · {row.publicId}</p>
            <p className="text-sm text-slate-500">{row.role} · {row.designation}</p>
          </article>
        ))}
      </section>
    </div>
  );
}
