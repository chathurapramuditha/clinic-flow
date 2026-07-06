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
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signUp: (
    email: string,
    password: string,
    meta: { name: string },
  ) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
  refreshRoles: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

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

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message };
  }, []);

  const signUp = useCallback(
    async (email: string, password: string, meta: { name: string; phone: string }) => {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: meta,
          emailRedirectTo: `${window.location.origin}/`,
        },
      });
      return { error: error?.message };
    },
    [],
  );

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
      signIn,
      signUp,
      signOut,
      refreshRoles,
    }),
    [user, session, roles, loading, signIn, signUp, signOut, refreshRoles],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
