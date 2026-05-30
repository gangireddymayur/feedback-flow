// Hybrid API client:
//  • In production (Plesk) it calls real /api/* endpoints backed by MariaDB.
//  • In the Lovable preview / dev sandbox (no backend), it transparently
//    falls back to in-memory mock data so the UI keeps working.
//
// The mode is decided lazily: the first failed network call (or a 404)
// flips the client into mock mode for the rest of the session.

import {
  templates as MOCK_TEMPLATES,
  devices as MOCK_DEVICES,
  responses as MOCK_RESPONSES,
  subAdmins as MOCK_ADMINS,
} from "./mock-data";

const TOKEN_KEY = "rms_token";
const MOCK_FLAG = "rms_mock_mode";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}
export function setToken(t: string | null) {
  if (typeof window === "undefined") return;
  if (t) localStorage.setItem(TOKEN_KEY, t);
  else localStorage.removeItem(TOKEN_KEY);
  window.dispatchEvent(new Event("rms-auth-change"));
}

function isMockMode(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(MOCK_FLAG) === "1";
}
function enableMockMode() {
  if (typeof window === "undefined") return;
  localStorage.setItem(MOCK_FLAG, "1");
  console.info("[api] backend unreachable — using in-memory mock data");
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function http<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");
  const token = getToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);

  let res: Response;
  try {
    res = await fetch(`/api${path}`, { ...init, headers });
  } catch {
    enableMockMode();
    throw new ApiError("Network error", 0);
  }
  if (res.status === 404 || res.status === 0) {
    enableMockMode();
    throw new ApiError("Not found", res.status);
  }
  const text = await res.text();
  const body = text ? safeJson(text) : null;
  if (!res.ok) throw new ApiError(body?.error || res.statusText, res.status);
  return body as T;
}

function safeJson(s: string) {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

const delay = (ms = 200) => new Promise((r) => setTimeout(r, ms));

// =================================================================
// Types
// =================================================================

export type Me = {
  id: number;
  name: string;
  email: string;
  role: "super" | "sub";
  status?: string;
};

export type ApiTemplate = {
  id: number;
  name: string;
  description: string;
  category: string;
  status: "active" | "inactive" | "draft";
  questions: Array<{
    id: string;
    type: string;
    label: string;
    required: boolean;
    options?: string[];
  }>;
  created_at: string;
  updated_at: string;
};

export type ApiDevice = {
  id: number;
  name: string;
  location: string | null;
  status: "online" | "offline" | "syncing";
  android_version: string | null;
  last_sync: string | null;
  template_id: number | null;
  responses_today: number;
};

export type ApiResponse = {
  id: number;
  template_id: number;
  template: string;
  device_id: number;
  device: string;
  rating: number | null;
  answers: Record<string, unknown>;
  submitted_at: string;
  duration_seconds: number;
};

export type ApiAdmin = {
  id: number;
  name: string;
  email: string;
  role: "super" | "sub";
  status: "active" | "disabled";
  created_at: string;
  devices: number;
  templates: number;
};

// =================================================================
// Mock store (used only when backend is unreachable)
// =================================================================

const seed = () => {
  const templates: ApiTemplate[] = MOCK_TEMPLATES.map((t, i) => ({
    id: i + 1,
    name: t.name,
    description: t.description,
    category: t.category,
    status: t.status,
    questions: Array.from({ length: t.questions }, (_, q) => ({
      id: `q${q + 1}`,
      type: q === 0 ? "rating" : "short_text",
      label: q === 0 ? "How was your experience?" : `Question ${q + 1}`,
      required: q === 0,
    })),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }));

  const devices: ApiDevice[] = MOCK_DEVICES.map((d, i) => ({
    id: i + 1,
    name: d.name,
    location: d.location,
    status: d.status,
    android_version: d.androidVersion,
    last_sync: new Date(Date.now() - i * 90 * 1000).toISOString(),
    template_id: templates.find((t) => t.name === d.template)?.id ?? null,
    responses_today: d.responsesToday,
  }));

  const responses: ApiResponse[] = MOCK_RESPONSES.map((r, i) => {
    const tpl = templates.find((t) => t.name === r.template);
    const dev = devices.find((d) => d.name === r.device);
    return {
      id: i + 1,
      template_id: tpl?.id ?? 1,
      template: r.template,
      device_id: dev?.id ?? 1,
      device: r.device,
      rating: r.rating,
      answers: r.comment ? { comment: r.comment } : {},
      submitted_at: new Date(Date.now() - i * 7 * 60 * 1000).toISOString(),
      duration_seconds:
        r.duration.split(":").reduce((a, b) => a * 60 + Number(b), 0) || 0,
    };
  });

  const admins: ApiAdmin[] = [
    {
      id: 1,
      name: "Therese",
      email: "admin@reviewos.app",
      role: "super",
      status: "active",
      created_at: new Date().toISOString(),
      devices: devices.length,
      templates: templates.length,
    },
    ...MOCK_ADMINS.map((a, i) => ({
      id: i + 2,
      name: a.name,
      email: a.email,
      role: "sub" as const,
      status: a.status,
      created_at: new Date().toISOString(),
      devices: a.devices,
      templates: a.templates,
    })),
  ];

  return { templates, devices, responses, admins };
};

const db = seed();

const DEMO_USER: Me = {
  id: 1,
  name: "Therese",
  email: "admin@reviewos.app",
  role: "super",
  status: "active",
};
function roleFromEmail(email: string): "super" | "sub" {
  const e = email.trim().toLowerCase();
  if (!e || e === DEMO_USER.email || e.startsWith("admin@") || e.includes("super")) return "super";
  return "sub";
}

// =================================================================
// Auth — tries real backend first, falls back to mock
// =================================================================

export const Auth = {
  login: async (email: string, password: string) => {
    if (!isMockMode()) {
      try {
        return await http<{ token: string; user: Me }>("/auth/login", {
          method: "POST",
          body: JSON.stringify({ email, password }),
        });
      } catch (e) {
        if (!(e instanceof ApiError) || e.status !== 0) throw e;
        // network failure → fall through to mock
      }
    }
    await delay();
    const role = roleFromEmail(email);
    return {
      token: "mock-token-" + Date.now(),
      user: {
        ...DEMO_USER,
        email: email || DEMO_USER.email,
        name: role === "super" ? "Therese" : email.split("@")[0] || "Sub Admin",
        role,
      },
    };
  },
  me: async () => {
    if (!isMockMode()) {
      try {
        return await http<{ user: Me }>("/me");
      } catch {
        /* fall through */
      }
    }
    await delay(50);
    return { user: DEMO_USER };
  },
  changePassword: async (current_password: string, new_password: string) => {
    if (!isMockMode()) {
      try {
        return await http<{ ok: true }>("/auth/password", {
          method: "PUT",
          body: JSON.stringify({ current_password, new_password }),
        });
      } catch (e) {
        if (!(e instanceof ApiError) || e.status !== 0) throw e;
      }
    }
    await delay();
    return { ok: true as const };
  },
};

// =================================================================
// Profile (org / timezone)
// =================================================================
export type ApiProfile = { organization: string | null; timezone: string | null; avatar_url: string | null };

const PROFILE_LS = "rms_profile_extra";
export const Profile = {
  get: async (): Promise<{ profile: ApiProfile }> => {
    if (!isMockMode()) {
      try { return await http<{ profile: ApiProfile }>("/profile"); }
      catch (e) { if (!(e instanceof ApiError) || e.status !== 0) throw e; }
    }
    await delay(50);
    try {
      const v = JSON.parse(localStorage.getItem(PROFILE_LS) || "{}");
      return { profile: { organization: v.organization ?? null, timezone: v.timezone ?? "UTC", avatar_url: null } };
    } catch { return { profile: { organization: null, timezone: "UTC", avatar_url: null } }; }
  },
  update: async (body: Partial<ApiProfile>) => {
    if (!isMockMode()) {
      try { return await http<{ ok: true }>("/profile", { method: "PUT", body: JSON.stringify(body) }); }
      catch (e) { if (!(e instanceof ApiError) || e.status !== 0) throw e; }
    }
    await delay(50);
    localStorage.setItem(PROFILE_LS, JSON.stringify(body));
    return { ok: true as const };
  },
};

// =================================================================
// Notification preferences
// =================================================================
export const Notifications = {
  get: async (): Promise<{ prefs: Record<string, boolean> }> => {
    if (!isMockMode()) {
      try { return await http<{ prefs: Record<string, boolean> }>("/notifications/prefs"); }
      catch (e) { if (!(e instanceof ApiError) || e.status !== 0) throw e; }
    }
    await delay(50);
    const prefs: Record<string, boolean> = {};
    if (typeof window !== "undefined") {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i)!;
        if (k.startsWith("rms_notif_")) prefs[k.slice(10)] = localStorage.getItem(k) === "1";
      }
    }
    return { prefs };
  },
  update: async (prefs: Record<string, boolean>) => {
    if (!isMockMode()) {
      try { return await http<{ ok: true }>("/notifications/prefs", { method: "PUT", body: JSON.stringify({ prefs }) }); }
      catch (e) { if (!(e instanceof ApiError) || e.status !== 0) throw e; }
    }
    await delay(30);
    for (const [k, v] of Object.entries(prefs)) localStorage.setItem(`rms_notif_${k}`, v ? "1" : "0");
    return { ok: true as const };
  },
};

// =================================================================
// Resources — real first, mock fallback (auto via http())
// =================================================================

export const Templates = {
  list: async () => {
    if (!isMockMode()) {
      try { return await http<{ templates: ApiTemplate[] }>("/templates"); }
      catch (e) { if (!(e instanceof ApiError) || e.status !== 0) throw e; }
    }
    await delay(); return { templates: db.templates };
  },
  create: async (body: Omit<ApiTemplate, "id" | "created_at" | "updated_at">) => {
    if (!isMockMode()) {
      try { return await http<{ id: number }>("/templates", { method: "POST", body: JSON.stringify(body) }); }
      catch (e) { if (!(e instanceof ApiError) || e.status !== 0) throw e; }
    }
    await delay();
    const id = (db.templates[db.templates.length - 1]?.id ?? 0) + 1;
    const now = new Date().toISOString();
    db.templates.push({ ...body, id, created_at: now, updated_at: now });
    return { id };
  },
  update: async (id: number, body: Omit<ApiTemplate, "id" | "created_at" | "updated_at">) => {
    if (!isMockMode()) {
      try { return await http<{ ok: true }>(`/templates/${id}`, { method: "PUT", body: JSON.stringify(body) }); }
      catch (e) { if (!(e instanceof ApiError) || e.status !== 0) throw e; }
    }
    await delay();
    const i = db.templates.findIndex((t) => t.id === id);
    if (i >= 0) db.templates[i] = { ...db.templates[i], ...body, updated_at: new Date().toISOString() };
    return { ok: true as const };
  },
  remove: async (id: number) => {
    if (!isMockMode()) {
      try { return await http<{ ok: true }>(`/templates/${id}`, { method: "DELETE" }); }
      catch (e) { if (!(e instanceof ApiError) || e.status !== 0) throw e; }
    }
    await delay();
    const i = db.templates.findIndex((t) => t.id === id);
    if (i >= 0) db.templates.splice(i, 1);
    return { ok: true as const };
  },
};

export const Devices = {
  list: async () => {
    if (!isMockMode()) {
      try { return await http<{ devices: ApiDevice[] }>("/devices"); }
      catch (e) { if (!(e instanceof ApiError) || e.status !== 0) throw e; }
    }
    await delay(); return { devices: db.devices };
  },
  pair: async (code: string, name: string, location: string) => {
    if (!isMockMode()) {
      try { return await http<{ id: number }>("/devices/pair", { method: "POST", body: JSON.stringify({ code, name, location }) }); }
      catch (e) { if (!(e instanceof ApiError) || e.status !== 0) throw e; }
    }
    await delay();
    const id = (db.devices[db.devices.length - 1]?.id ?? 0) + 1;
    db.devices.push({
      id, name, location, status: "online",
      android_version: "Android 14",
      last_sync: new Date().toISOString(),
      template_id: db.templates[0]?.id ?? null,
      responses_today: 0,
    });
    return { id };
  },
  generatePairingCode: async (): Promise<{ code: string; expires_in_seconds: number }> => {
    if (!isMockMode()) {
      try { return await http<{ code: string; expires_in_seconds: number }>("/devices/pairing-code", { method: "POST" }); }
      catch (e) { if (!(e instanceof ApiError) || e.status !== 0) throw e; }
    }
    await delay(120);
    return { code: String(Math.floor(100000 + Math.random() * 900000)), expires_in_seconds: 600 };
  },
  assignTemplate: async (id: number, template_id: number | null) => {
    if (!isMockMode()) {
      try { return await http<{ ok: true }>(`/devices/${id}/template`, { method: "PUT", body: JSON.stringify({ template_id }) }); }
      catch (e) { if (!(e instanceof ApiError) || e.status !== 0) throw e; }
    }
    await delay(120);
    const d = db.devices.find((x) => x.id === id);
    if (d) d.template_id = template_id;
    return { ok: true as const };
  },
  remove: async (id: number) => {
    if (!isMockMode()) {
      try { return await http<{ ok: true }>(`/devices/${id}`, { method: "DELETE" }); }
      catch (e) { if (!(e instanceof ApiError) || e.status !== 0) throw e; }
    }
    await delay();
    const i = db.devices.findIndex((d) => d.id === id);
    if (i >= 0) db.devices.splice(i, 1);
    return { ok: true as const };
  },
};

export const Responses = {
  list: async () => {
    if (!isMockMode()) {
      try { return await http<{ responses: ApiResponse[] }>("/responses"); }
      catch (e) { if (!(e instanceof ApiError) || e.status !== 0) throw e; }
    }
    await delay(); return { responses: db.responses };
  },
};

export const Admins = {
  list: async () => {
    if (!isMockMode()) {
      try { return await http<{ admins: ApiAdmin[] }>("/admins"); }
      catch (e) { if (!(e instanceof ApiError) || e.status !== 0) throw e; }
    }
    await delay(); return { admins: db.admins };
  },
  create: async (body: { name: string; email: string; password: string; role?: "sub" | "super" }) => {
    if (!isMockMode()) {
      try { return await http<{ id: number }>("/admins", { method: "POST", body: JSON.stringify(body) }); }
      catch (e) { if (!(e instanceof ApiError) || e.status !== 0) throw e; }
    }
    await delay();
    const id = (db.admins[db.admins.length - 1]?.id ?? 0) + 1;
    db.admins.push({
      id, name: body.name, email: body.email,
      role: body.role ?? "sub", status: "active",
      created_at: new Date().toISOString(),
      devices: 0, templates: 0,
    });
    return { id };
  },
  setStatus: async (id: number, status: "active" | "disabled") => {
    if (!isMockMode()) {
      try { return await http<{ ok: true }>(`/admins/${id}/status`, { method: "PUT", body: JSON.stringify({ status }) }); }
      catch (e) { if (!(e instanceof ApiError) || e.status !== 0) throw e; }
    }
    await delay();
    const a = db.admins.find((x) => x.id === id);
    if (a) a.status = status;
    return { ok: true as const };
  },
};
