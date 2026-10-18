import { useEffect, useState } from "react";
import { api } from "../lib/api";

type Settings = {
  schoolName: string;
  address: string;
  admin: { firstName: string; lastName: string; email: string; phone: string };
};

export function SchoolSettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [address, setAddress] = useState("");
  const [admin, setAdmin] = useState({ firstName: "", lastName: "", email: "", phone: "" });
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    api<Settings>("/api/v1/school/settings")
      .then((data) => {
        setSettings(data);
        setAddress(data.address);
        setAdmin(data.admin);
      })
      .catch((caught: unknown) => setError(caught instanceof Error ? caught.message : "Could not load settings."));
  }, []);

  async function saveAddress(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setMessage("");
    try {
      await api("/api/v1/school/settings", { method: "PATCH", body: JSON.stringify({ address }) });
      setMessage("School address updated.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not update the address.");
    }
  }

  async function saveAdmin(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setMessage("");
    try {
      await api("/api/v1/school/settings/profile", { method: "PATCH", body: JSON.stringify(admin) });
      setMessage("Administrator details updated.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not update the administrator.");
    }
  }

  if (!settings && !error) return <p className="text-sm text-slate-500">Loading settings...</p>;

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <form onSubmit={saveAddress} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-950">School</h2>
        <label className="mt-4 block text-sm text-slate-600">School name
          <input className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-100 px-3 py-2" value={settings?.schoolName ?? ""} readOnly />
        </label>
        <label className="mt-4 block text-sm text-slate-600">Address
          <textarea className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" value={address} onChange={(event) => setAddress(event.target.value)} required />
        </label>
        <button className="mt-4 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white">Save address</button>
      </form>

      <form onSubmit={saveAdmin} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-950">Administrator</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <label className="text-sm text-slate-600">First name
            <input className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" value={admin.firstName} onChange={(event) => setAdmin({ ...admin, firstName: event.target.value })} required />
          </label>
          <label className="text-sm text-slate-600">Last name
            <input className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" value={admin.lastName} onChange={(event) => setAdmin({ ...admin, lastName: event.target.value })} required />
          </label>
          <label className="text-sm text-slate-600">Email
            <input className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" type="email" value={admin.email} onChange={(event) => setAdmin({ ...admin, email: event.target.value })} required />
          </label>
          <label className="text-sm text-slate-600">Phone
            <input className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" value={admin.phone} onChange={(event) => setAdmin({ ...admin, phone: event.target.value })} />
          </label>
        </div>
        <button className="mt-4 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white">Save administrator</button>
      </form>
      {message ? <p className="text-sm text-blue-700">{message}</p> : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
