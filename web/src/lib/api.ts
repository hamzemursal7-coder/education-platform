export type SessionUser = {
  id: string;
  email: string;
  role: string;
  firstName: string;
  lastName: string;
  schoolId: string | null;
  school?: { id: string; name: string; code: string; type: string } | null;
  actingFromSuperAdmin?: boolean;
};

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (response.status === 401 && path !== "/api/v1/auth/login") {
    const refreshed = await fetch("/api/v1/auth/refresh", { method: "POST", credentials: "include" });
    if (refreshed.ok) {
      const retry = await fetch(path, {
        ...init,
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...(init?.headers ?? {}),
        },
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
  return response.json() as Promise<T>;
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
