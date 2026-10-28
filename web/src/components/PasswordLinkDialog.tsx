import { useState } from "react";
import { Check, Copy, ExternalLink, Link2, X } from "lucide-react";

export function passwordLinkUrl(path: string) {
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  return `${window.location.origin}${path.startsWith("/") ? path : `/${path}`}`;
}

export function PasswordLinkDialog({
  url,
  email,
  onClose,
}: {
  url: string;
  email?: string;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const whatsApp = `https://wa.me/?text=${encodeURIComponent(`Set your new password here: ${url}`)}`;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/55 p-4" onClick={onClose}>
      <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-start gap-4">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-blue-50 text-blue-600">
            <Link2 className="h-6 w-6" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-3">
              <h3 className="text-xl font-bold text-slate-950">Password link is ready</h3>
              <button type="button" className="rounded-full p-1 text-slate-400 hover:bg-slate-100" onClick={onClose} aria-label="Close">
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="mt-1 text-sm leading-6 text-slate-600">
              Copy this link, open it directly, or send it on WhatsApp{email ? <> to <span className="font-semibold text-slate-900">{email}</span></> : ""}. It works once. After the password is saved, the same link cannot be used again.
            </p>
          </div>
        </div>
        <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
          <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">One-time link</p>
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="mt-1 block break-all text-sm font-semibold leading-6 text-blue-600 hover:underline"
          >
            {url}
          </a>
        </div>
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button type="button" className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50" onClick={onClose}>Close</button>
          <a
            className="inline-flex items-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm font-semibold text-blue-700 hover:bg-blue-100"
            href={url}
            target="_blank"
            rel="noreferrer"
          >
            <ExternalLink className="h-4 w-4" />
            Open link
          </a>
          <a className="inline-flex items-center rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-semibold text-emerald-700 hover:bg-emerald-100" href={whatsApp} target="_blank" rel="noreferrer">Send on WhatsApp</a>
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-500"
            onClick={() => {
              void navigator.clipboard.writeText(url).then(() => setCopied(true)).catch(() => {
                const area = document.createElement("textarea");
                area.value = url;
                area.setAttribute("readonly", "");
                area.style.position = "fixed";
                area.style.left = "-9999px";
                document.body.appendChild(area);
                area.select();
                const ok = document.execCommand("copy");
                area.remove();
                if (ok) setCopied(true);
              });
            }}
          >
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copied ? "Copied" : "Copy link"}
          </button>
        </div>
      </div>
    </div>
  );
}
