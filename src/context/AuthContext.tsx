import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User as SupabaseUser } from "@supabase/supabase-js";

import { requireSupabaseConfig, supabase } from "@/lib/supabase";
import { createUserProfile } from "@/lib/supabaseService";

export interface AuthUser {
  id: string;
  uid: string;
  email: string | null;
  displayName: string | null;
}

interface AuthContextType {
  user: AuthUser | null;
  session: Session | null;
  loading: boolean;
  register: (name: string, email: string, password: string) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

function toAuthUser(user: SupabaseUser | null | undefined): AuthUser | null {
  if (!user) {
    return null;
  }

  const displayName =
    typeof user.user_metadata?.full_name === "string"
      ? user.user_metadata.full_name
      : typeof user.user_metadata?.name === "string"
        ? user.user_metadata.name
        : null;

  return {
    id: user.id,
    uid: user.id,
    email: user.email || null,
    displayName,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  const register = async (name: string, email: string, password: string) => {
    try {
      requireSupabaseConfig();

      const cleanName = name.trim() || "Candidate";
      const cleanEmail = email.trim();

      const { data, error } = await supabase.auth.signUp({
        email: cleanEmail,
        password,
        options: {
          data: {
            full_name: cleanName,
            name: cleanName,
          },
        },
      });

      if (error) {
        throw error;
      }

      const signedUpUser = data.user;
      const signedUpSession = data.session;

      if (!signedUpUser) {
        throw new Error("Supabase did not return a user for this signup.");
      }

      if (!signedUpSession) {
        setSession(null);
        setUser(null);
        throw new Error("Account created. Check your email to confirm your account, then log in.");
      }

      await createUserProfile({
        userId: signedUpUser.id,
        name: cleanName,
        email: signedUpUser.email || cleanEmail,
      });

      setSession(signedUpSession);
      setUser(toAuthUser(signedUpUser));
    } catch (error) {
      console.error("Supabase register error:", error);
      throw error;
    }
  };

  const login = async (email: string, password: string) => {
    try {
      requireSupabaseConfig();

      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        throw error;
      }

      const loggedInUser = data.user;
      const loggedInSession = data.session;

      if (!loggedInUser || !loggedInSession) {
        throw new Error("Supabase did not return a valid login session.");
      }

      setSession(loggedInSession);
      setUser(toAuthUser(loggedInUser));
    } catch (error) {
      console.error("Supabase login error:", error);
      throw error;
    }
  };

  const logout = async () => {
    try {
      requireSupabaseConfig();

      const { error } = await supabase.auth.signOut();

      if (error) {
        throw error;
      }

      setSession(null);
      setUser(null);
    } catch (error) {
      console.error("Supabase logout error:", error);
      throw error;
    }
  };

  useEffect(() => {
    let mounted = true;

    const loadSession = async () => {
      try {
        if (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY) {
          setSession(null);
          setUser(null);
          return;
        }

        const { data, error } = await supabase.auth.getSession();

        if (error) {
          throw error;
        }

        if (mounted) {
          setSession(data.session);
          setUser(toAuthUser(data.session?.user));
        }
      } catch (error) {
        console.error("Supabase session load error:", error);
        if (mounted) {
          setSession(null);
          setUser(null);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(toAuthUser(session?.user));
      setLoading(false);
    });

    void loadSession();

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user, session, loading, register, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }

  return context;
}
