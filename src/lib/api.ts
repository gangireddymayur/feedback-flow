// Lightweight typed fetch client for the Plesk Node.js backend.
// Set VITE_API_URL in .env (no trailing slash). The site MUST be HTTPS.

const RAW = (import.meta.env.VITE_API_URL as string | undefined) ?? "";
export const API_BASE = RAW.replace(/\/+$/, "");

const TOKEN_KEY = "rms_token";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}
export function setToken(t: string | null) {
  if (typeof window === "undefined") return;
  if (t) localStorage.setItem(TOKEN_KEY, t);
  else localStorage.removeItem(TOKEN_KEY);
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

type Opts = { method?: string; body?: unknown; auth?: boolean };

export async function api<T = unknown>(path: string, opts: Opts = {}): Promise<T> {
  if (!API_BASE) throw new ApiError("VITE_API_URL is not set", 0);
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (opts.auth !== false) {
    const tok = getToken();
    if (tok) headers.Authorization = `Bearer ${tok}`;
  }
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method: opts.method ?? "GET",
      headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });
  } catch (e) {
    throw new ApiError(
      `Network error reaching API. Check VITE_API_URL, CORS, and SSL. (${(e as Error).message})`,
      0,
    );
  }
  const text = await res.text();
  const data = text ? (() => { try { return JSON.parse(text); } catch { return text; } })() : null;
  if (!res.ok) {
    const msg = (data && typeof data === "object" && "error" in data) ? String((data as { error: unknown }).error) : `Request failed (${res.status})`;
    throw new ApiError(msg, res.status);
  }
  return data as T;
}

// ===== Typed wrappers =====

export type Me = { id: number; name: string; email: string; role: "super" | "sub"; status?: string };

export const Auth = {
  login: (email: string, password: string) =>
    api<{ token: string; user: Me }>("/api/auth/login", { method: "POST", body: { email, password }, auth: false }),
  me: () => api<{ user: Me }>("/api/auth/me"),
};

export type ApiTemplate = {
  id: number; name: string; description: string; category: string;
  status: "active" | "inactive" | "draft";
  questions: Array<{ id: string; type: string; label: string; required: boolean; options?: string[] }>;
  created_at: string; updated_at: string;
};
export const Templates = {
  list: () => api<{ templates: ApiTemplate[] }>("/api/templates"),
  create: (body: Omit<ApiTemplate, "id" | "created_at" | "updated_at">) =>
    api<{ id: number }>("/api/templates", { method: "POST", body }),
  update: (id: number, body: Omit<ApiTemplate, "id" | "created_at" | "updated_at">) =>
    api<{ ok: true }>(`/api/templates/${id}`, { method: "PUT", body }),
  remove: (id: number) => api<{ ok: true }>(`/api/templates/${id}`, { method: "DELETE" }),
};

export type ApiDevice = {
  id: number; name: string; location: string | null;
  status: "online" | "offline" | "syncing";
  android_version: string | null; last_sync: string | null;
  template_id: number | null; responses_today: number;
};
export const Devices = {
  list: () => api<{ devices: ApiDevice[] }>("/api/devices"),
  pair: (code: string, name: string, location: string) =>
    api<{ id: number }>("/api/devices/pair", { method: "POST", body: { code, name, location } }),
  remove: (id: number) => api<{ ok: true }>(`/api/devices/${id}`, { method: "DELETE" }),
};

export type ApiResponse = {
  id: number; template_id: number; template: string;
  device_id: number; device: string;
  rating: number | null; answers: Record<string, unknown>;
  submitted_at: string; duration_seconds: number;
};
export const Responses = {
  list: () => api<{ responses: ApiResponse[] }>("/api/responses"),
};

export type ApiAdmin = {
  id: number; name: string; email: string; role: "super" | "sub";
  status: "active" | "disabled"; created_at: string; devices: number; templates: number;
};
export const Admins = {
  list: () => api<{ admins: ApiAdmin[] }>("/api/admins"),
  create: (body: { name: string; email: string; password: string; role?: "sub" | "super" }) =>
    api<{ id: number }>("/api/admins", { method: "POST", body }),
  setStatus: (id: number, status: "active" | "disabled") =>
    api<{ ok: true }>(`/api/admins/${id}/status`, { method: "PATCH", body: { status } }),
};
