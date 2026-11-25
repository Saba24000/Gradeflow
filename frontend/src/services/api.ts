const API_BASE = "/api";

export interface User {
  id: number;
  name: string;
  email: string;
  role: "user" | "admin";
  is_banned?: boolean;
  ban_reason?: string | null;
  created_at?: string;
}

export interface Assignment {
  id: number;
  title: string;
  course_code: string;
  description: string;
  due_date: string;
  status: string;
  owner_id: number;
  group_id: number | null;
  assigned_to_id: number | null;
}

export interface GroupMember {
  user_id: number;
  email: string;
  permissions: string[];
}

export interface Group {
  id: number;
  name: string;
  description: string;
  owner_id: number;
  members: GroupMember[];
}

function extractErrorMessage(data: any, fallback: string): string {
  if (!data) return fallback;
  if (typeof data === "string") return data;
  if (typeof data.detail === "string") return data.detail;
  if (Array.isArray(data.detail)) {
    return data.detail
      .map((err: any) => {
        const field = Array.isArray(err.loc) ? err.loc[err.loc.length - 1] : "";
        return field ? `${field}: ${err.msg}` : err.msg;
      })
      .join(" | ");
  }
  return fallback;
}

export function getStoredTokens() {
  return {
    accessToken: localStorage.getItem("access_token"),
    refreshToken: localStorage.getItem("refresh_token"),
  };
}

export function saveAuthSession(accessToken: string, refreshToken: string, user: User) {
  localStorage.setItem("access_token", accessToken);
  localStorage.setItem("refresh_token", refreshToken);
  localStorage.setItem("user", JSON.stringify(user));
}

export function clearAuthSession() {
  localStorage.removeItem("access_token");
  localStorage.removeItem("refresh_token");
  localStorage.removeItem("user");
}

async function tryRefreshToken(): Promise<string | null> {
  const { refreshToken } = getStoredTokens();
  try {
    const res = await fetch(`${API_BASE}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    saveAuthSession(data.access_token, data.refresh_token, data.user);
    return data.access_token;
  } catch {
    return null;
  }
}

export async function apiFetch<T = any>(
  path: string,
  options: RequestInit = {},
  retry = true
): Promise<T> {
  const { accessToken } = getStoredTokens();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (accessToken) {
    headers["Authorization"] = `Bearer ${accessToken}`;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
    credentials: "include",
  });

  if (res.status === 401 && retry && !path.startsWith("/auth/login") && !path.startsWith("/auth/signup")) {
    const newToken = await tryRefreshToken();
    if (newToken) {
      return apiFetch<T>(path, options, false);
    }
    clearAuthSession();
    window.dispatchEvent(new Event("auth:expired"));
    throw new Error("Session expired. Please log in again.");
  }

  const text = await res.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    if (!res.ok) {
      throw new Error(`Server error (${res.status}): ${text.slice(0, 120) || res.statusText}`);
    }
  }

  if (!res.ok) {
    throw new Error(extractErrorMessage(data, `Request failed (${res.status})`));
  }

  return data as T;
}