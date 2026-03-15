import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from "react";
import type { Session, User } from "@supabase/supabase-js";

import {
  isSupabaseConfigured,
  supabase,
  supabaseConfigurationMessage,
} from "../lib/supabase/client";

interface AuthContextValue {
  isConfigured: boolean;
  isLoading: boolean;
  session: Session | null;
  user: User | null;
  configurationMessage: string | null;
  signInWithMagicLink(email: string): Promise<void>;
  signOut(): Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function getMagicLinkRedirectUrl(): string | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }

  return new URL("/account", window.location.origin).toString();
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!supabase) {
      setIsLoading(false);
      return;
    }

    let isMounted = true;

    void supabase.auth.getSession().then(({ data, error }) => {
      if (!isMounted) {
        return;
      }

      setSession(data.session ?? null);
      setIsLoading(false);

      if (error) {
        setSession(null);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!isMounted) {
        return;
      }

      setSession(nextSession);
      setIsLoading(false);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      isConfigured: isSupabaseConfigured,
      isLoading,
      session,
      user: session?.user ?? null,
      configurationMessage: supabaseConfigurationMessage,
      async signInWithMagicLink(email: string) {
        if (!supabase) {
          throw new Error(
            supabaseConfigurationMessage ?? "Supabase auth is not configured.",
          );
        }

        const { error } = await supabase.auth.signInWithOtp({
          email,
          options: {
            emailRedirectTo: getMagicLinkRedirectUrl(),
          },
        });

        if (error) {
          throw error;
        }
      },
      async signOut() {
        if (!supabase) {
          return;
        }

        const { error } = await supabase.auth.signOut();

        if (error) {
          throw error;
        }
      },
    }),
    [isLoading, session],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);

  if (!value) {
    throw new Error("Auth context is unavailable.");
  }

  return value;
}
