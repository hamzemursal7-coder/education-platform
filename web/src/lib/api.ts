export type SessionUser = {
  id: string;
  email: string;
  role: string;
  firstName: string;
  lastName: string;
  phone?: string | null;
  photoUrl?: string | null;
  schoolId: string | null;
  school?: { id: string; name: string; code: string; type: string } | null;
  actingFromSuperAdmin?: boolean;
};

const sessionStorageKey = "emp_session";

function sessionHeaders(init?: RequestInit): HeadersInit {
  const key = sessionStorage.getItem(sessionStorageKey) ?? "";
  return {
    "Content-Type": "application/json",
    ...(key ? { "X-Session-Key": key } : {}),
    ...(init?.headers ?? {}),
  };
}

function rememberSession(body: unknown) {
  if (!body || typeof body !== "object" || !("sessionKey" in body)) return;
  const key = (body as { sessionKey?: unknown }).sessionKey;
  if (typeof key === "string" && key) sessionStorage.setItem(sessionStorageKey, key);
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    credentials: "include",
    headers: sessionHeaders(init),
  });
  if (response.status === 401 && path !== "/api/v1/auth/login" && path !== "/api/v1/auth/refresh") {
    const refreshed = await fetch("/api/v1/auth/refresh", {
      method: "POST",
      credentials: "include",
      headers: sessionHeaders(),
    });
    if (refreshed.ok) {
      rememberSession(await refreshed.clone().json().catch(() => null));
      const retry = await fetch(path, {
        ...init,
        credentials: "include",
        headers: sessionHeaders(init),
      });
      if (!retry.ok) {
        const body = (await retry.json().catch(() => null)) as { message?: string } | null;
        throw new Error(body?.message ?? "Request failed.");
      }
      return retry.json() as Promise<T>;
    }
  }
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { message?: string } | null;
    throw new Error(body?.message ?? "Request failed.");
  }
  const payload = (await response.json()) as T;
  if (path === "/api/v1/auth/logout") sessionStorage.removeItem(sessionStorageKey);
  else rememberSession(payload);
  return payload;
}

export async function apiBlob(path: string, init?: RequestInit): Promise<{ blob: Blob; filename: string }> {
  let response = await fetch(path, {
    ...init,
    credentials: "include",
    headers: {
      ...(sessionStorage.getItem(sessionStorageKey) ? { "X-Session-Key": sessionStorage.getItem(sessionStorageKey)! } : {}),
      ...(init?.headers ?? {}),
    },
  });

  if (response.status === 401) {
    const refreshed = await fetch("/api/v1/auth/refresh", {
      method: "POST",
      credentials: "include",
      headers: sessionHeaders(),
    });
    if (refreshed.ok) {
      rememberSession(await refreshed.clone().json().catch(() => null));
      response = await fetch(path, {
        ...init,
        credentials: "include",
        headers: {
          ...(sessionStorage.getItem(sessionStorageKey) ? { "X-Session-Key": sessionStorage.getItem(sessionStorageKey)! } : {}),
          ...(init?.headers ?? {}),
        },
      });
    }
  }

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { message?: string } | null;
    throw new Error(body?.message ?? "Failed to download document.");
  }

  const disposition = response.headers.get("content-disposition") || "";
  let filename = "document.docx";
  const match = disposition.match(/filename="?([^";]+)"?/i);
  if (match && match[1]) {
    filename = match[1];
  }

  const blob = await response.blob();
  return { blob, filename };
}

export const homeByRole: Record<string, string> = {
  SUPER_ADMIN: "/superadmin/dashboard",
  SCHOOL_ADMIN: "/school/dashboard",
  TEACHER: "/teacher/dashboard",
  ACCOUNTANT: "/accountant/dashboard",
  STAFF: "/staff/dashboard",
  PARENT: "/parent/dashboard",
  STUDENT: "/student/dashboard",
};
