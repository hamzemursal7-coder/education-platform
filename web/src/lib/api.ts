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

function getStoredSessionKey(): string {
  try {
    return sessionStorage.getItem(sessionStorageKey) || localStorage.getItem(sessionStorageKey) || "";
  } catch {
    return "";
  }
}

function sessionHeaders(init?: RequestInit): HeadersInit {
  const key = getStoredSessionKey();
  return {
    "Content-Type": "application/json",
    ...(key ? { "X-Session-Key": key } : {}),
    ...(init?.headers ?? {}),
  };
}

function rememberSession(body: unknown) {
  if (!body || typeof body !== "object" || !("sessionKey" in body)) return;
  const key = (body as { sessionKey?: unknown }).sessionKey;
  if (typeof key === "string" && key) {
    try {
      sessionStorage.setItem(sessionStorageKey, key);
      localStorage.setItem(sessionStorageKey, key);
    } catch {
      // storage unavailable
    }
  }
}

function clearStoredSession() {
  try {
    sessionStorage.removeItem(sessionStorageKey);
    localStorage.removeItem(sessionStorageKey);
  } catch {
    // ignore
  }
}

async function extractHttpError(response: Response, defaultMessage: string): Promise<Error> {
  // First attempt to parse JSON error message
  try {
    const body = (await response.clone().json()) as { message?: string; error?: string } | null;
    if (body?.message && typeof body.message === "string" && body.message.trim()) {
      return new Error(body.message.trim());
    }
    if (body?.error && typeof body.error === "string" && body.error.trim()) {
      return new Error(body.error.trim());
    }
  } catch {
    // Non-JSON response (e.g. HTML or plain text error from proxy/Express)
  }

  // Provide clear, actionable status-code specific messages
  switch (response.status) {
    case 400:
      return new Error("Invalid request payload. Please verify your inputs.");
    case 401:
      return new Error("Your session has expired or authentication is required. Please log in again.");
    case 403:
      return new Error("You do not have permission to access this resource or perform this action.");
    case 404:
      return new Error("The requested service or route was not found (404). The backend service may still be updating.");
    case 409:
      return new Error("A data conflict occurred. Please refresh the page and try again.");
    case 422:
      return new Error("The submitted data was unprocessable. Please verify your inputs.");
    case 500:
      return new Error("An internal server error occurred (500). Please try again shortly.");
    case 502:
    case 503:
    case 504:
      return new Error("The backend server is temporarily unavailable or restarting. Please try again in a few moments.");
    default:
      return new Error(defaultMessage || `Request failed with status ${response.status}.`);
  }
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
        throw await extractHttpError(retry, "Request failed.");
      }
      return retry.json() as Promise<T>;
    }
  }

  if (!response.ok) {
    throw await extractHttpError(response, "Request failed.");
  }

  const payload = (await response.json()) as T;
  if (path === "/api/v1/auth/logout") clearStoredSession();
  else rememberSession(payload);
  return payload;
}

export async function apiBlob(path: string, init?: RequestInit): Promise<{ blob: Blob; filename: string }> {
  const key = getStoredSessionKey();
  let response = await fetch(path, {
    ...init,
    credentials: "include",
    headers: {
      ...(key ? { "X-Session-Key": key } : {}),
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
          ...(getStoredSessionKey() ? { "X-Session-Key": getStoredSessionKey() } : {}),
          ...(init?.headers ?? {}),
        },
      });
    }
  }

  if (!response.ok) {
    throw await extractHttpError(response, "Failed to download document.");
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
