import * as React from "react";
import type { Role } from "./mock-data";

type AuthState = { role: Role; name: string; email: string };

const KEY = "rms_auth";

export function getAuth(): AuthState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as AuthState) : null;
  } catch {
    return null;
  }
}

export function setAuth(a: AuthState | null) {
  if (typeof window === "undefined") return;
  if (a) localStorage.setItem(KEY, JSON.stringify(a));
  else localStorage.removeItem(KEY);
  window.dispatchEvent(new Event("rms-auth-change"));
}

export function useAuth() {
  const [auth, setState] = React.useState<AuthState | null>(null);
  React.useEffect(() => {
    setState(getAuth());
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
