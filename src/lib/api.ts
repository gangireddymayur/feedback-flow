// Pure client-side mock "API". No backend, no Plesk, no network.
// All data lives in memory and resets on page reload.

import {
  templates as MOCK_TEMPLATES,
  devices as MOCK_DEVICES,
  responses as MOCK_RESPONSES,
  subAdmins as MOCK_ADMINS,
} from "./mock-data";

export const API_BASE = "mock";

const TOKEN_KEY = "rms_token";

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

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

const delay = (ms = 250) => new Promise((r) => setTimeout(r, ms));

// ===== Types (kept stable for the rest of the app) =====

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

// ===== Seed in-memory stores from mock-data =====

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
    last_sync: d.lastSync,
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
      submitted_at: r.submittedAt,
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

// ===== Auth =====

const DEMO_USER: Me = {
  id: 1,
  name: "Therese",
  email: "admin@reviewos.app",
  role: "super",
  status: "active",
};

export const Auth = {
  login: async (email: string, _password: string) => {
    await delay();
    return {
      token: "mock-token-" + Date.now(),
      user: { ...DEMO_USER, email: email || DEMO_USER.email },
    };
  },
  me: async () => {
    await delay(80);
    return { user: DEMO_USER };
  },
};

// ===== Templates =====

export const Templates = {
  list: async () => {
    await delay();
    return { templates: db.templates };
  },
  create: async (body: Omit<ApiTemplate, "id" | "created_at" | "updated_at">) => {
    await delay();
    const id = (db.templates.at(-1)?.id ?? 0) + 1;
    const now = new Date().toISOString();
    db.templates.push({ ...body, id, created_at: now, updated_at: now });
    return { id };
  },
  update: async (
    id: number,
    body: Omit<ApiTemplate, "id" | "created_at" | "updated_at">,
  ) => {
    await delay();
    const i = db.templates.findIndex((t) => t.id === id);
    if (i >= 0)
      db.templates[i] = {
        ...db.templates[i],
        ...body,
        updated_at: new Date().toISOString(),
      };
    return { ok: true as const };
  },
  remove: async (id: number) => {
    await delay();
    const i = db.templates.findIndex((t) => t.id === id);
    if (i >= 0) db.templates.splice(i, 1);
    return { ok: true as const };
  },
};

// ===== Devices =====

export const Devices = {
  list: async () => {
    await delay();
    return { devices: db.devices };
  },
  pair: async (_code: string, name: string, location: string) => {
    await delay();
    const id = (db.devices.at(-1)?.id ?? 0) + 1;
    db.devices.push({
      id,
      name,
      location,
      status: "online",
      android_version: "Android 14",
      last_sync: "just now",
      template_id: db.templates[0]?.id ?? null,
      responses_today: 0,
    });
    return { id };
  },
  remove: async (id: number) => {
    await delay();
    const i = db.devices.findIndex((d) => d.id === id);
    if (i >= 0) db.devices.splice(i, 1);
    return { ok: true as const };
  },
};

// ===== Responses =====

export const Responses = {
  list: async () => {
    await delay();
    return { responses: db.responses };
  },
};

// ===== Admins =====

export const Admins = {
  list: async () => {
    await delay();
    return { admins: db.admins };
  },
  create: async (body: {
    name: string;
    email: string;
    password: string;
    role?: "sub" | "super";
  }) => {
    await delay();
    const id = (db.admins.at(-1)?.id ?? 0) + 1;
    db.admins.push({
      id,
      name: body.name,
      email: body.email,
      role: body.role ?? "sub",
      status: "active",
      created_at: new Date().toISOString(),
      devices: 0,
      templates: 0,
    });
    return { id };
  },
  setStatus: async (id: number, status: "active" | "disabled") => {
    await delay();
    const a = db.admins.find((x) => x.id === id);
    if (a) a.status = status;
    return { ok: true as const };
  },
};
