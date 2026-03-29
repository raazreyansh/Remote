import type { AuthSession } from "./types";

const SESSION_KEY = "restaurant-saas-admin-session";

export const saveSession = (session: AuthSession) => {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
};

export const readSession = (): AuthSession | null => {
  const raw = localStorage.getItem(SESSION_KEY);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as AuthSession;
  } catch {
    return null;
  }
};

export const clearSession = () => {
  localStorage.removeItem(SESSION_KEY);
};
