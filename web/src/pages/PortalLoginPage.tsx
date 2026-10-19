import { useState, type ComponentType } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Eye, EyeOff, GraduationCap, Lock, Mail, Presentation, School, Shield, Users } from "lucide-react";
import { api, homeByRole, type SessionUser } from "../lib/api";

export type PortalLoginKey = "parent" | "student" | "teacher" | "school" | "super";

const portals: Record<PortalLoginKey, {
  title: string;
  subtitle: string;
  emailLabel: string;
  button: string;
  role: string;
  denied: string;
  page: string;
  blob: string;
  titleColor: string;
  buttonClass: string;
  watermark: string;
  icon: ComponentType<{ className?: string }>;
}> = {
  parent: {
    title: "Parent Login",
    subtitle: "Parent Portal",
    emailLabel: "Email",
    button: "Sign In",
    role: "PARENT",
    denied: "This sign-in is only for a parent account.",
    page: "bg-[#eef5ff]",
    blob: "bg-blue-200/70",
    titleColor: "text-[#2563eb]",
    buttonClass: "bg-[#3b82f6] hover:bg-[#2563eb]",
    watermark: "text-blue-200/80",
    icon: Users,
  },
  student: {
    title: "Student Login",
    subtitle: "Student Dashboard",
    emailLabel: "Email",
    button: "Sign In",
    role: "STUDENT",
    denied: "This sign-in is only for a student account.",
    page: "bg-[#f4efff]",
    blob: "bg-violet-200/70",
    titleColor: "text-[#6d28d9]",
    buttonClass: "bg-[#7c3aed] hover:bg-[#6d28d9]",
    watermark: "text-violet-200/80",
    icon: GraduationCap,
  },
  teacher: {
    title: "Teacher Login",
    subtitle: "Teacher Dashboard",
    emailLabel: "Email",
    button: "Sign In",
    role: "TEACHER",
    denied: "This sign-in is only for a teacher account.",
    page: "bg-[#eefbf3]",
    blob: "bg-emerald-200/70",
    titleColor: "text-[#15803d]",
    buttonClass: "bg-[#16a34a] hover:bg-[#15803d]",
    watermark: "text-emerald-200/80",
    icon: Presentation,
  },
  school: {
    title: "School Admin Login",
    subtitle: "School Dashboard",
    emailLabel: "Email",
    button: "Sign In",
    role: "SCHOOL_ADMIN",
    denied: "This sign-in is only for a school admin account.",
    page: "bg-[#fff6ee]",
    blob: "bg-orange-200/70",
    titleColor: "text-[#ea580c]",
    buttonClass: "bg-[#f97316] hover:bg-[#ea580c]",
    watermark: "text-orange-200/80",
    icon: School,
  },
  super: {
    title: "Super Admin Login",
    subtitle: "Super Admin Dashboard",
    emailLabel: "Email Address",
    button: "Sign In as Super Admin",
    role: "SUPER_ADMIN",
    denied: "This sign-in is only for a Super Admin account.",
    page: "bg-[#f4f8ff]",
    blob: "bg-sky-200/80",
    titleColor: "text-[#1d4ed8]",
    buttonClass: "bg-[#2563eb] hover:bg-[#1d4ed8]",
    watermark: "text-blue-200/80",
    icon: Shield,
  },
};

export function PortalLoginCard({ portal, onSuccess }: { portal: PortalLoginKey; onSuccess: (user: SessionUser) => void }) {
  const navigate = useNavigate();
  const config = portals[portal];
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError("");
    try {
      const previous = sessionStorage.getItem("emp_session");
      const user = await api<SessionUser & { sessionKey?: string }>("/api/v1/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      if (user.role !== config.role) {
        await api("/api/v1/auth/logout", { method: "POST" });
        if (previous) sessionStorage.setItem("emp_session", previous);
        setError(config.denied);
        return;
      }
      onSuccess(user);
      navigate(homeByRole[user.role] ?? "/login");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Login failed.");
    } finally {
      setPending(false);
    }
  }

  return (
        <form onSubmit={submit} className="w-full max-w-[420px] rounded-[28px] bg-white px-7 py-9 shadow-[0_24px_60px_-28px_rgba(15,23,42,0.45)] sm:px-9">
          <div className="text-center">
            <img
              src="/school-logo.svg"
              alt="Ilays Educational Academy"
              width={160}
              height={160}
              className="mx-auto h-28 w-28 object-contain"
            />
            <h1 className={`mt-4 text-[1.65rem] font-bold tracking-tight ${config.titleColor}`}>{config.title}</h1>
            <p className="mt-2 text-sm text-slate-500">Welcome to Ilays academy</p>
            <p className="text-sm text-slate-500">{config.subtitle}</p>
          </div>
          <label className="mt-7 block text-sm font-medium text-slate-600">
            {config.emailLabel}
            <span className="relative mt-1.5 block">
              <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-10 pr-3 text-sm text-slate-800 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
                type="email"
                autoComplete="username"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </span>
          </label>
          <label className="mt-4 block text-sm font-medium text-slate-600">
            Password
            <span className="relative mt-1.5 block">
              <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-10 pr-11 text-sm text-slate-800 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
              <button
                type="button"
                className="absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-lg text-slate-400 hover:text-slate-600"
                aria-label={showPassword ? "Hide password" : "Show password"}
                onClick={() => setShowPassword((current) => !current)}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </span>
          </label>
          {error ? <p className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p> : null}
          <button
            className={`mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-white shadow-sm disabled:opacity-60 ${config.buttonClass}`}
            disabled={pending}
          >
            {pending ? "Signing in..." : config.button}
            <ArrowRight className="h-4 w-4" />
          </button>
        </form>
  );
}

export function PortalLoginPage({ portal, onSuccess }: { portal: PortalLoginKey; onSuccess: (user: SessionUser) => void }) {
  const config = portals[portal];
  const Mark = config.icon;
  return (
    <main className={`relative min-h-screen overflow-hidden ${config.page}`}>
      <div className="pointer-events-none absolute -left-24 -top-28 h-72 w-[28rem] rounded-full bg-white/80 blur-2xl" />
      <div className={`pointer-events-none absolute -right-20 top-8 h-64 w-64 rounded-full blur-3xl ${config.blob}`} />
      <div className="pointer-events-none absolute -bottom-24 left-1/2 h-56 w-[36rem] -translate-x-1/2 rounded-full bg-white/80 blur-2xl" />
      <div className={`pointer-events-none absolute bottom-8 left-1/2 -translate-x-1/2 ${config.watermark}`} aria-hidden="true">
        <Mark className="h-24 w-24" />
      </div>
      <div className="relative grid min-h-screen place-items-center px-4 py-10">
        <PortalLoginCard portal={portal} onSuccess={onSuccess} />
      </div>
    </main>
  );
}
