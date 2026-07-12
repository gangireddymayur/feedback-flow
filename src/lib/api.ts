// Real-only API client — always calls the live /api/* backend.
// No mock fallback. If the backend is unreachable, the UI shows an error state.

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
  body: any;
  constructor(message: string, status: number, body?: any) {
    super(message);
    this.status = status;
    this.body = body;
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
    throw new ApiError("Network error — check your connection", 0);
  }

  const text = await res.text();
  const body = text ? safeJson(text) : null;
  if (!res.ok) throw new ApiError(body?.error || res.statusText, res.status, body);
  return body as T;
}

function safeJson(s: string) {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

// =================================================================
// Types
// =================================================================

export type Me = {
  id: number;
  name: string;
  email: string;
  role: "super" | "sub";
  status?: string;
  local_mode?: "none" | "solo" | "network";
  max_devices?: number;
};

export type ApiTemplate = {
  id: number;
  name: string;
  description: string;
  category: string;
  status: "active" | "inactive" | "draft";
  displayMode?: "multi_page" | "single_page";
  branding?: {
    enabled: boolean;
    companyName: string;
    logoUrl: string;
    position: "top_left" | "top_right" | "bottom_left" | "bottom_right";
    size: number;
    offsetX: number;
    offsetY: number;
  } | null;
  questions: Array<{
    id: string;
    type: string;
    label: string;
    required: boolean;
    options?: string[];
    width?: "full" | "half";
    maxStars?: number;
    starLabels?: string[];
    emojis?: Array<{ emoji: string; label: string }>;
    yesLabel?: string;
    noLabel?: string;
    collectName?: boolean;
    collectEmail?: boolean;
    collectPhone?: boolean;
  }>;
  created_at: string;
  updated_at: string;
};

export type ApiDevice = {
  id: number;
  name: string;
  location: string | null;
  status: "online" | "offline" | "syncing" | "paused";
  android_version: string | null;
  last_sync: string | null;
  template_id: number | null;
  responses_today: number;
  schedules_enabled?: number;
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
  template_questions?: ApiTemplate["questions"];
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
  local_mode?: "none" | "single" | "multi";
  max_devices?: number;
};

export type ApiProfile = {
  organization: string | null;
  timezone: string | null;
  avatar_url: string | null;
  show_brand_header?: number;
  brand_header_placement?: string;
};

// =================================================================
// Auth
// =================================================================

export const Auth = {
  login: async (email: string, password: string) => {
    return await http<{ token: string; user: Me }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
  },
  me: async () => {
    return await http<{ user: Me }>("/me");
  },
  changePassword: async (current_password: string, new_password: string) => {
    return await http<{ ok: true }>("/auth/password", {
      method: "PUT",
      body: JSON.stringify({ current_password, new_password }),
    });
  },
};

// =================================================================
// Profile
// =================================================================

export const Profile = {
  get: async (): Promise<{ profile: ApiProfile }> => {
    return await http<{ profile: ApiProfile }>("/profile");
  },
  update: async (body: Partial<ApiProfile>) => {
    return await http<{ ok: true }>("/profile", {
      method: "PUT",
      body: JSON.stringify(body),
    });
  },
};

export const Upload = {
  file: async (filename: string, base64Data: string): Promise<{ ok: true; url: string }> => {
    return await http<{ ok: true; url: string }>("/upload", {
      method: "POST",
      body: JSON.stringify({ filename, base64Data }),
    });
  },
};

// =================================================================
// Notification preferences
// =================================================================

export const Notifications = {
  get: async (): Promise<{ prefs: Record<string, boolean> }> => {
    return await http<{ prefs: Record<string, boolean> }>("/notifications/prefs");
  },
  update: async (prefs: Record<string, boolean>) => {
    return await http<{ ok: true }>("/notifications/prefs", {
      method: "PUT",
      body: JSON.stringify({ prefs }),
    });
  },
};

// =================================================================
// Templates
// =================================================================

export const Templates = {
  list: async () => {
    return await http<{ templates: ApiTemplate[] }>("/templates");
  },
  get: async (id: number) => {
    return await http<ApiTemplate>(`/templates/${id}`);
  },
  create: async (body: Omit<ApiTemplate, "id" | "created_at" | "updated_at">) => {
    return await http<{ id: number }>("/templates", {
      method: "POST",
      body: JSON.stringify(body),
    });
  },
  update: async (id: number, body: Omit<ApiTemplate, "id" | "created_at" | "updated_at">) => {
    return await http<{ ok: true }>(`/templates/${id}`, {
      method: "PUT",
      body: JSON.stringify(body),
    });
  },
  remove: async (id: number) => {
    return await http<{ ok: true }>(`/templates/${id}`, { method: "DELETE" });
  },
};

// =================================================================
// Devices
// =================================================================

export const Devices = {
  list: async () => {
    return await http<{ devices: ApiDevice[] }>("/devices");
  },
  pair: async (code: string, name: string, location: string) => {
    return await http<{ id: number }>("/devices/pair", {
      method: "POST",
      body: JSON.stringify({ code, name, location }),
    });
  },
  generatePairingCode: async (): Promise<{ code: string; expires_in_seconds: number }> => {
    return await http<{ code: string; expires_in_seconds: number }>("/devices/pairing-code", {
      method: "POST",
    });
  },
  assignTemplate: async (id: number, template_id: number | null) => {
    return await http<{ ok: true }>(`/devices/${id}/template`, {
      method: "PUT",
      body: JSON.stringify({ template_id }),
    });
  },
  update: async (
    id: number,
    body: {
      name?: string;
      location?: string | null;
      status?: ApiDevice["status"];
      schedules_enabled?: boolean;
      template_id?: number | null;
    },
  ) => {
    return await http<{ ok: true }>(`/devices/${id}`, {
      method: "PUT",
      body: JSON.stringify(body),
    });
  },
  remove: async (id: number) => {
    return await http<{ ok: true }>(`/devices/${id}`, { method: "DELETE" });
  },
};

// =================================================================
// Schedules
// =================================================================

export type RepeatMode = "none" | "daily" | "custom";

export type ApiScheduleInstance = {
  id: number;
  schedule_id: number;
  device_id: number;
  template_id: number;
  template_name: string | null;
  date: string; // YYYY-MM-DD
  start_time: string; // HH:MM
  end_time: string;   // HH:MM
  start_datetime: string;
  end_datetime: string;
};

export type ApiSchedule = {
  id: number;
  device_id: number;
  template_id: number;
  template_name: string | null;
  start_time: string; // HH:MM
  end_time: string;   // HH:MM
  start_date: string; // YYYY-MM-DD
  repeat_mode: RepeatMode;
  repeat_interval: number;
  days_count: number;
};

export const Schedules = {
  list: async (deviceId: number) => {
    return await http<{ schedules: ApiSchedule[]; instances: ApiScheduleInstance[] }>(`/schedules/device/${deviceId}`);
  },
  create: async (body: {
    device_id: number;
    template_id: number;
    start_time: string;
    end_time: string;
    start_date: string;
    repeat_mode: RepeatMode;
    repeat_interval?: number;
    days_count?: number;
  }) => {
    return await http<{ ok: true; id: number; created_instances: number }>("/schedules", {
      method: "POST",
      body: JSON.stringify(body),
    });
  },
  update: async (
    id: number,
    body: {
      template_id?: number;
      start_time?: string;
      end_time?: string;
      start_date?: string;
      repeat_mode?: RepeatMode;
      repeat_interval?: number;
      days_count?: number;
    }
  ) => {
    return await http<{ ok: true; created_instances: number }>(`/schedules/${id}`, {
      method: "PUT",
      body: JSON.stringify(body),
    });
  },
  remove: async (id: number, date?: string) => {
    const url = date ? `/schedules/${id}?date=${date}` : `/schedules/${id}`;
    return await http<{ ok: true }>(url, { method: "DELETE" });
  },
  repeat: async (body: {
    schedule_id: number;
    repeat_mode: RepeatMode;
    repeat_interval?: number;
    days_count?: number;
    start_time?: string;
    end_time?: string;
    overwrite?: boolean;
  }) => {
    return await http<{ ok: true; created_instances: number }>("/schedules/repeat", {
      method: "POST",
      body: JSON.stringify(body),
    });
  },
  exception: async (body: {
    schedule_id: number;
    date: string;
    start_time: string;
    end_time: string;
    template_id: number;
  }) => {
    return await http<{ ok: true }>("/schedules/exception", {
      method: "POST",
      body: JSON.stringify(body),
    });
  },
  copyDay: async (body: { device_id: number; source_date: string; target_dates: string[]; overwrite?: boolean }) => {
    return await http<{ ok: boolean; has_existing?: boolean; existing_dates?: string[]; created?: number }>("/schedules/copy-day", {
      method: "POST",
      body: JSON.stringify(body),
    });
  },
  clearDay: async (body: { device_id: number; date: string }) => {
    return await http<{ ok: boolean }>("/schedules/clear-day", {
      method: "POST",
      body: JSON.stringify(body),
    });
  },
  copyDevice: async (body: { target_device_id: number; source_device_id: number; overwrite?: boolean }) => {
    return await http<{ ok: boolean; has_existing?: boolean; created?: number }>("/schedules/copy-device", {
      method: "POST",
      body: JSON.stringify(body),
    });
  },
};

// =================================================================
// Responses
// =================================================================

export const Responses = {
  list: async () => {
    return await http<{ responses: ApiResponse[] }>("/responses");
  },
  reportList: async (params?: { device_id?: string | number; from_date?: string; to_date?: string }) => {
    let url = "/reports/responses";
    const query = new URLSearchParams();
    if (params?.device_id) query.append("device_id", String(params.device_id));
    if (params?.from_date) query.append("from_date", params.from_date);
    if (params?.to_date) query.append("to_date", params.to_date);
    const qs = query.toString();
    if (qs) url += "?" + qs;
    return await http<{ responses: ApiResponse[] }>(url);
  },
};

// =================================================================
// Admins
// =================================================================

export const Admins = {
  list: async () => {
    return await http<{ admins: ApiAdmin[] }>("/admins");
  },
  create: async (body: { name: string; email: string; password: string; role?: "sub" | "super"; local_mode?: "none" | "single" | "multi"; max_devices?: number }) => {
    return await http<{ id: number }>("/admins", {
      method: "POST",
      body: JSON.stringify(body),
    });
  },
  setStatus: async (id: number, status: "active" | "disabled") => {
    return await http<{ ok: true }>(`/admins/${id}/status`, {
      method: "PUT",
      body: JSON.stringify({ status }),
    });
  },
};

// =================================================================
// Screensavers
// =================================================================

export type ApiScreensaver = {
  id: number;
  owner_id: number;
  name: string;
  url: string;
  type: "image" | "video";
  is_active: number;
  timeout_seconds: number;
  created_at: string;
};

export const Screensavers = {
  list: async () => {
    return await http<{ screensavers: ApiScreensaver[] }>("/screensavers");
  },
  upload: async (body: { name: string; filename: string; base64Data: string; type: "image" | "video" }) => {
    return await http<{ ok: boolean; screensaver: ApiScreensaver }>("/screensavers/upload", {
      method: "POST",
      body: JSON.stringify(body),
    });
  },
  activate: async (body: { id: number; timeout_seconds: number }) => {
    return await http<{ ok: boolean }>("/screensavers/activate", {
      method: "POST",
      body: JSON.stringify(body),
    });
  },
  deactivate: async () => {
    return await http<{ ok: boolean }>("/screensavers/deactivate", {
      method: "POST",
    });
  },
  remove: async (id: number) => {
    return await http<{ ok: boolean }>(`/screensavers/${id}`, {
      method: "DELETE",
    });
  },
};

// =================================================================
// Backup & Restore
// =================================================================

export const Backup = {
  download: async (): Promise<any> => {
    return await http<any>("/backup");
  },
  restore: async (payload: any): Promise<{ ok: true }> => {
    return await http<{ ok: true }>("/restore", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
};
