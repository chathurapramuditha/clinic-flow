import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { AppRole } from "@/lib/types";

type AuthContextValue = {
  user: User | null;
  session: Session | null;
  roles: AppRole[];
  loading: boolean;
  isAdmin: boolean;
  isTherapist: boolean;
  isPatient: boolean;
  empNumber: string | null;
  signIn: (empNumber: string, password: string) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
  refreshRoles: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function empToEmail(emp: string) {
  return `${emp.trim().toLowerCase()}@staff.local`;
}

function emailToEmp(email: string | undefined | null): string | null {
  if (!email) return null;
  const [local, domain] = email.split("@");
  if (domain !== "staff.local") return null;
  return local.toUpperCase();
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);

  const loadRoles = useCallback(async (uid: string | null) => {
    if (!uid) {
      setRoles([]);
      return;
    }
    const { data } = await supabase.from("user_roles").select("role").eq("user_id", uid);
    setRoles((data ?? []).map((r) => r.role as AppRole));
  }, []);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      setUser(data.session?.user ?? null);
      void loadRoles(data.session?.user.id ?? null).finally(() => {
        if (mounted) setLoading(false);
      });
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      setUser(s?.user ?? null);
      void loadRoles(s?.user.id ?? null);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [loadRoles]);

  const signIn = useCallback(async (empNumber: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: empToEmail(empNumber),
        password,
      });
      if (error) {
        const msg = /invalid/i.test(error.message)
          ? "Invalid employee number or password."
          : error.message;
        return { error: msg };
      }
      return {};
    } catch (err) {
      return {
        error: err instanceof Error ? err.message : "An unexpected error occurred during sign in.",
      };
    }
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  const refreshRoles = useCallback(async () => {
    await loadRoles(user?.id ?? null);
  }, [loadRoles, user?.id]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      session,
      roles,
      loading,
      isAdmin: roles.includes("admin"),
      isTherapist: roles.includes("therapist"),
      isPatient: roles.includes("patient"),
      empNumber: emailToEmp(user?.email ?? null),
      signIn,
      signOut,
      refreshRoles,
    }),
    [user, session, roles, loading, signIn, signOut, refreshRoles],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
