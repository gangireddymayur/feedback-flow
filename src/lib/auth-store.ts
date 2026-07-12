import * as React from "react";
import { Auth, getToken, setToken, type Me } from "./api";

export type Role = "super" | "sub";
export type AuthState = { role: Role; name: string; email: string; id: number; local_mode?: "none" | "solo" | "network"; max_devices?: number };

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
  return { id: u.id, name: u.name, email: u.email, role: u.role, local_mode: u.local_mode, max_devices: u.max_devices };
}

export async function loginWithApi(email: string, password: string) {
  const { token, user } = await Auth.login(email, password);
  setToken(token);
  const state = toState(user);
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
