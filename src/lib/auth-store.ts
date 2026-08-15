import * as React from "react";
import { Auth, getToken, setToken, type Me, ApiError } from "./api";

export type Role = "super" | "sub";
export type AuthState = {
  role: Role;
  name: string;
  email: string;
  id: number;
  local_mode?: "none" | "solo" | "network";
  max_devices?: number;
  subscription_status?: "trial" | "active" | "expired";
  trial_info?: {
    isExpired: boolean;
    status: "trial" | "active" | "expired";
    daysLeft: number;
    trialEndsAt: string | null;
    createdAt: string | null;
  };
};

const USER_KEY = "rms_user";

export function getAuth(): AuthState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(USER_KEY);
    if (!raw || !getToken()) return null;
    const parsed = JSON.parse(raw) as AuthState;
    if (parsed && (parsed.local_mode === "none" || !parsed.local_mode)) {
      if (window.location.port === "8080" || window.location.hostname === "localhost") {
        parsed.local_mode = "solo";
      }
    }
    return parsed;
  } catch {
    return null;
  }
}

function persist(a: AuthState | null) {
  if (typeof window === "undefined") return;
  if (a) localStorage.setItem(USER_KEY, JSON.stringify(a));
  else localStorage.removeItem(USER_KEY);
  window.dispatchEvent(new Event("rms-auth-change"));
}

function toState(u: Me): AuthState {
  if (!u) throw new Error("Authentication response missing user data");
  const isLocalServer =
    typeof window !== "undefined" &&
    (window.location.port === "3000" ||
      window.location.port === "8080" ||
      window.location.hostname === "localhost");
  const localMode =
    u.local_mode === "single"
      ? "solo"
      : u.local_mode === "multi"
        ? "network"
        : isLocalServer && (u.local_mode === "none" || !u.local_mode)
          ? "solo"
          : u.local_mode;
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    local_mode: localMode,
    max_devices: u.max_devices,
    subscription_status: u.subscription_status,
    trial_info: u.trial_info,
  };
}

export async function loginWithApi(email: string, password: string) {
  try {
    const res = await Auth.login(email, password);
    if (res.require_code) {
      return { require_code: true, email: res.email || email };
    }
    if (!res.token || !res.user) {
      throw new Error("Invalid response from login server");
    }
    setToken(res.token);
    const state = toState(res.user);
    persist(state);
    return state;
  } catch (err) {
    // If the server returned 403 with code_required, surface that instead of an error
    if (err instanceof ApiError && err.body?.code_required) {
      return { require_code: true, no_code_available: true, email };
    }
    throw err;
  }
}

export async function verifyCodeWithApi(email: string, password: string, code: string) {
  const res = await Auth.verifyCode(email, password, code);
  if (!res.token || !res.user) {
    throw new Error("Invalid verification response from server");
  }
  setToken(res.token);
  const state = toState(res.user);
  persist(state);
  return state;
}

export async function refreshAuth() {
  try {
    const token = getToken();
    if (!token) return null;
    const { user } = await Auth.me();
    const state = toState(user);
    persist(state);
    return state;
  } catch (e) {
    console.error("Refresh auth failed:", e);
    return null;
  }
}

export function logout() {
  setToken(null);
  persist(null);
}

export function useAuth() {
  const [auth, setState] = React.useState<AuthState | null>(null);
  React.useEffect(() => {
    setState(getAuth());

    // Refresh session on mount to sync local_mode
    refreshAuth().then((updated) => {
      if (updated) setState(updated);
    });

    const h = () => setState(getAuth());
    window.addEventListener("rms-auth-change", h);
    window.addEventListener("storage", h);
    return () => {
      window.removeEventListener("rms-auth-change", h);
      window.removeEventListener("storage", h);
    };
  }, []);
  return auth;
}
