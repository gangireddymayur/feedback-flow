import * as React from "react";
import { Auth, getToken, setToken, type Me } from "./api";

export type Role = "super" | "sub";
export type AuthState = { role: Role; name: string; email: string; id: number };

const USER_KEY = "rms_user";

export function getAuth(): AuthState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(USER_KEY);
    if (!raw || !getToken()) return null;
    return JSON.parse(raw) as AuthState;
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
  return { id: u.id, name: u.name, email: u.email, role: u.role };
}

export async function loginWithApi(email: string, password: string) {
  const { token, user } = await Auth.login(email, password);
  setToken(token);
  const state = toState(user);
  persist(state);
  return state;
}

export function logout() {
  setToken(null);
  persist(null);
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
