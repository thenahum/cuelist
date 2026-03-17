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
  addObservabilityBreadcrumb,
  captureObservabilityError,
  startObservabilityTimeout,
  setObservabilityUser,
} from "../lib/observability";
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
  sendEmailOtp(email: string): Promise<void>;
  verifyEmailOtp(email: string, token: string): Promise<void>;
  signOut(): Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);
const authRoute = "/account";

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setObservabilityUser(session?.user.id ?? null);
  }, [session?.user.id]);

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
        captureObservabilityError(error, {
          operation: "auth.get_session",
          route: "/account",
        });
        setSession(null);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!isMounted) {
        return;
      }

      addObservabilityBreadcrumb({
        category: "auth",
        message: "Auth state changed",
        data: {
          event,
          hasSession: Boolean(nextSession),
          route: "/account",
        },
      });
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
      async sendEmailOtp(email: string) {
        if (!supabase) {
          throw new Error(
            supabaseConfigurationMessage ?? "Supabase auth is not configured.",
          );
        }

        addObservabilityBreadcrumb({
          category: "auth",
          message: "Email sign-in code requested",
          data: {
            action: "send_email_otp",
            route: authRoute,
          },
        });

        const startedAt = Date.now();
        const clearTimeout = startObservabilityTimeout({
          operation: "auth.send_email_otp",
          route: authRoute,
          timeoutMs: 12000,
          message: "OTP send took longer than expected.",
          context: {
            action: "send_email_otp",
          },
        });

        try {
          const { error } = await supabase.auth.signInWithOtp({
            email,
            options: {
              shouldCreateUser: true,
            },
          });

          if (error) {
            throw error;
          }

          addObservabilityBreadcrumb({
            category: "auth",
            message: "Email sign-in code sent",
            data: {
              action: "send_email_otp",
              durationMs: Date.now() - startedAt,
              route: authRoute,
              status: "success",
            },
          });
        } catch (error) {
          addObservabilityBreadcrumb({
            category: "auth",
            level: "error",
            message: "Email sign-in code failed",
            data: {
              action: "send_email_otp",
              durationMs: Date.now() - startedAt,
              route: authRoute,
              status: "failure",
            },
          });
          captureObservabilityError(error, {
            operation: "auth.send_email_otp",
            route: authRoute,
            context: {
              action: "send_email_otp",
              durationMs: Date.now() - startedAt,
              status: "failure",
            },
          });
          throw error;
        } finally {
          clearTimeout();
        }
      },
      async verifyEmailOtp(email: string, token: string) {
        if (!supabase) {
          throw new Error(
            supabaseConfigurationMessage ?? "Supabase auth is not configured.",
          );
        }

        addObservabilityBreadcrumb({
          category: "auth",
          message: "Email sign-in code verification started",
          data: {
            action: "verify_email_otp",
            route: authRoute,
          },
        });

        const startedAt = Date.now();
        const clearTimeout = startObservabilityTimeout({
          operation: "auth.verify_email_otp",
          route: authRoute,
          timeoutMs: 12000,
          message: "OTP verification took longer than expected.",
          context: {
            action: "verify_email_otp",
          },
        });

        try {
          const { error } = await supabase.auth.verifyOtp({
            email,
            token,
            type: "email",
          });

          if (error) {
            throw error;
          }

          addObservabilityBreadcrumb({
            category: "auth",
            message: "Email sign-in code verified",
            data: {
              action: "verify_email_otp",
              durationMs: Date.now() - startedAt,
              route: authRoute,
              status: "success",
            },
          });
        } catch (error) {
          addObservabilityBreadcrumb({
            category: "auth",
            level: "error",
            message: "Email sign-in code verification failed",
            data: {
              action: "verify_email_otp",
              durationMs: Date.now() - startedAt,
              route: authRoute,
              status: "failure",
            },
          });
          captureObservabilityError(error, {
            operation: "auth.verify_email_otp",
            route: authRoute,
            context: {
              action: "verify_email_otp",
              durationMs: Date.now() - startedAt,
              status: "failure",
            },
          });
          throw error;
        } finally {
          clearTimeout();
        }
      },
      async signOut() {
        if (!supabase) {
          return;
        }

        addObservabilityBreadcrumb({
          category: "auth",
          message: "Sign out started",
          data: {
            action: "sign_out",
            route: "/account",
          },
        });

        try {
          const { error } = await supabase.auth.signOut();

          if (error) {
            throw error;
          }

          addObservabilityBreadcrumb({
            category: "auth",
            message: "Sign out completed",
            data: {
              action: "sign_out",
              route: "/account",
            },
          });
        } catch (error) {
          captureObservabilityError(error, {
            operation: "auth.sign_out",
            route: "/account",
            context: {
              action: "sign_out",
            },
          });
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
