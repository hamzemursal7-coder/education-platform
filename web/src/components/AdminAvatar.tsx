export function PersonInSuitIcon({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      {/* Background circular gradient */}
      <circle cx="32" cy="32" r="32" fill="#1e293b" />
      
      {/* Head */}
      <circle cx="32" cy="21" r="9.5" fill="#e2e8f0" />
      
      {/* Neck */}
      <rect x="29" y="29" width="6" height="5" fill="#cbd5e1" />
      
      {/* Shoulders base */}
      <path d="M10 58 C10 44 20 37 32 37 C44 37 54 44 54 58 Z" fill="#334155" />
      
      {/* White Dress Shirt V-Neck */}
      <path d="M25 36 L32 45 L39 36 Z" fill="#ffffff" />
      
      {/* Royal Blue Necktie */}
      <path d="M30.5 39 L33.5 39 L34.5 49 L32 54 L29.5 49 Z" fill="#2563eb" />
      <polygon points="30,38 34,38 33,40 31,40" fill="#1d4ed8" />
      
      {/* Left Suit Jacket & Lapel */}
      <path d="M10 58 C10 45 19 37 26 36 L32 46 L24 58 Z" fill="#0f172a" />
      
      {/* Right Suit Jacket & Lapel */}
      <path d="M54 58 C54 45 45 37 38 36 L32 46 L40 58 Z" fill="#0f172a" />
      
      {/* Subtle Lapel Lines */}
      <path d="M26 36 L28.5 44" stroke="#475569" strokeWidth="0.8" strokeLinecap="round" />
      <path d="M38 36 L35.5 44" stroke="#475569" strokeWidth="0.8" strokeLinecap="round" />
    </svg>
  );
}

export function AdminAvatar({
  photoUrl,
  name,
  size = "md",
  className = "",
}: {
  photoUrl?: string | null;
  name?: string;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  className?: string;
}) {
  const sizeClasses = {
    xs: "h-7 w-7",
    sm: "h-8 w-8",
    md: "h-10 w-10",
    lg: "h-14 w-14",
    xl: "h-20 w-20",
  };

  const currentSize = sizeClasses[size] || sizeClasses.md;

  if (photoUrl) {
    return (
      <img
        src={photoUrl}
        alt={name || "Admin profile"}
        className={`${currentSize} rounded-full object-cover border-2 border-white shadow-sm ring-1 ring-slate-200 ${className}`}
      />
    );
  }

  // Fallback to Person in Suit icon as requested by the user!
  return (
    <div
      className={`${currentSize} rounded-full overflow-hidden shrink-0 border-2 border-white shadow-sm ring-1 ring-slate-200 ${className}`}
      title={name || "Admin in Suit"}
    >
      <PersonInSuitIcon className="h-full w-full" />
    </div>
  );
}
