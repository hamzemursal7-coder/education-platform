import { useState } from "react";

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

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/55 p-4">
      <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl">
        <h3 className="text-xl font-bold text-slate-950">Copy the password link</h3>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Copy this link and send it on WhatsApp or email{email ? ` to ${email}` : ""}. It works once. After the password is saved, the same link cannot be used again.
        </p>
        <input className="mt-4 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-800" readOnly value={url} onFocus={(event) => event.currentTarget.select()} />
        <a className="mt-3 inline-flex text-sm font-semibold text-blue-700 hover:underline" href={url} target="_blank" rel="noreferrer">Open link</a>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" className="rounded-lg bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700" onClick={onClose}>Close</button>
          <button
            type="button"
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white"
            onClick={() => {
              void navigator.clipboard.writeText(url).then(() => setCopied(true));
            }}
          >
            {copied ? "Copied" : "Copy link"}
          </button>
        </div>
      </div>
    </div>
  );
}
