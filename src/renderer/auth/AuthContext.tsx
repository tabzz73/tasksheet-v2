import React, { createContext, useContext } from "react";
import type { SessionSummary } from "../../application/useCases/auth.js";

export interface AuthContextValue {
  session: SessionSummary;
  refresh: () => void;
  logout: () => void;
  lock: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ value, children }: { value: AuthContextValue; children: React.ReactNode }): React.JSX.Element {
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth() called outside an authenticated session");
  return ctx;
}
