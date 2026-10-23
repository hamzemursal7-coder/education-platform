import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import type { SessionUser } from "../lib/api";

const slides = [
  {
    name: "Parent Portal",
    line: "Parent Portal",
    action: "Continue as Parent",
    href: "/parent/login",
    title: "text-[#2563eb]",
    button: "bg-[#2f7cf6] hover:bg-[#1d6ef0]",
    dot: "bg-[#2f7cf6]",
  },
  {
    name: "Student Portal",
    line: "Student Portal",
    action: "Continue as Student",
    href: "/student/login",
    title: "text-[#6d28d9]",
    button: "bg-[#7c3aed] hover:bg-[#6d28d9]",
    dot: "bg-[#7c3aed]",
  },
];

export function LoginPage({ onSuccess: _onSuccess }: { onSuccess: (user: SessionUser) => void }) {
  const navigate = useNavigate();
  const [index, setIndex] = useState(0);
  const slide = slides[index];

  function step(direction: number) {
    setIndex((value) => (value + direction + slides.length) % slides.length);
  }

  return (
    <main className="grid min-h-screen place-items-center bg-white px-4 py-10">
      <div className="flex w-full max-w-3xl flex-col items-center">
        <p className="flex items-center gap-3 text-[11px] font-semibold tracking-[0.22em] text-[#16345c] sm:text-xs">
          <span className="h-px w-8 bg-[#16345c]/50 sm:w-12" />
          ILAYS EDUCATIONAL ACADEMY
          <span className="h-px w-8 bg-[#16345c]/50 sm:w-12" />
        </p>
        <h1 className="mt-4 text-center text-4xl font-bold tracking-tight text-[#10284a] sm:text-5xl">
          Choose Your <span className="text-[#2f7cf6]">Portal</span>
        </h1>
        <p className="mt-2 text-sm text-[#4b6280] sm:text-base">Select your portal to continue</p>
        <section className="mt-7 w-full max-w-[420px] rounded-[28px] border border-slate-200 bg-white px-6 py-8 text-center shadow-sm sm:px-9">
          <img
            src="/school-logo.svg"
            alt="Ilays Educational Academy"
            width={160}
            height={160}
            className="mx-auto h-24 w-24 object-contain"
          />
          <div className="mt-6 flex items-center justify-center gap-3">
            <button
              type="button"
              className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm"
              aria-label="Previous portal"
              onClick={() => step(-1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <h2 className={`min-w-0 text-2xl font-bold ${slide.title}`}>{slide.name}</h2>
            <button
              type="button"
              className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm"
              aria-label="Next portal"
              onClick={() => step(1)}
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          <p className="mt-2 text-sm text-slate-500">Welcome to Ilays Academy</p>
          <p className="text-sm text-slate-500">{slide.line}</p>
          <div className="mt-4 flex items-center justify-center gap-1.5" aria-hidden="true">
            {slides.map((item, dotIndex) => (
              <span key={item.href} className={`h-2 w-2 rounded-full ${dotIndex === index ? slide.dot : "bg-slate-300"}`} />
            ))}
          </div>
          <button
            type="button"
            className={`mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-white shadow-sm ${slide.button}`}
            onClick={() => navigate(slide.href)}
          >
            {slide.action}
            <ArrowRight className="h-4 w-4" />
          </button>
        </section>
      </div>
    </main>
  );
}
