import type { User, Session } from "@supabase/supabase-js";
import type { ReactNode } from "react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { invokeAuthApiEnvelope } from "@/lib/auth-api";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import type {
  LoginResponseData,
  ProfileGetData,
  ProfilePayload,
  TenantPayload,
} from "@/types/auth-api";

export type AuthLoginPayload = {
  email: string;
  password: string;
  tenantDomain?: string;
  tenantId?: string;
};

export type AuthSignupPayload = {
  tenantName: string;
  industry?: string;
  domainHint?: string;
  fullName: string;
  email: string;
  password: string;
  inviteToken?: string;
  acceptTerms: boolean;
};

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  isLoading: boolean;
  isConfigured: boolean;
  profile: ProfilePayload;
  tenant: TenantPayload;
  profileBundle: ProfileGetData | null;
  refreshProfileBundle: () => Promise<void>;
  signInWithPassword: (
    payload: AuthLoginPayload,
  ) => Promise<{ ok: boolean; error?: string; code?: string }>;
  signUp: (payload: AuthSignupPayload) => Promise<{ ok: boolean; error?: string }>;
  signOut: () => Promise<void>;
  ensureProfile: () => Promise<void>;
  resolveInvitation: (token: string) => Promise<{
    ok: boolean;
    email?: string;
    companyName?: string;
    error?: string;
  }>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [profile, setProfile] = useState<ProfilePayload>(null);
  const [tenant, setTenant] = useState<TenantPayload>(null);
  const [profileBundle, setProfileBundle] = useState<ProfileGetData | null>(null);

  const refreshProfileBundle = useCallback(async () => {
    if (!isSupabaseConfigured) return;
    const { data: s } = await supabase.auth.getSession();
    if (!s.session?.access_token) {
      setProfileBundle(null);
      return;
    }
    const res = await invokeAuthApiEnvelope<ProfileGetData>({ op: "profile.get" });
    if (res.data) {
      setProfile(res.data.profile ?? null);
      setTenant(res.data.tenant ?? null);
      setProfileBundle(res.data);
    }
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setIsLoading(false);
      return;
    }

    let cancelled = false;

    void supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      setSession(data.session ?? null);
      setUser(data.session?.user ?? null);
      setIsLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!session?.access_token) {
      setProfile(null);
      setTenant(null);
      setProfileBundle(null);
      return;
    }
    void refreshProfileBundle();
  }, [session?.access_token, refreshProfileBundle]);

  const signInWithPassword = useCallback(
    async (payload: AuthLoginPayload) => {
      const res = await invokeAuthApiEnvelope<LoginResponseData>(
        {
          op: "auth.login",
          email: payload.email,
          password: payload.password,
          tenantDomain: payload.tenantDomain,
          tenantId: payload.tenantId,
        },
        { skipAuthHeader: true },
      );
      if (res.error || !res.data?.session) {
        return {
          ok: false as const,
          error: res.error?.message ?? "Sign-in failed",
          code: typeof res.meta?.code === "string" ? res.meta.code : undefined,
        };
      }
      const { error } = await supabase.auth.setSession({
        access_token: res.data.session.access_token,
        refresh_token: res.data.session.refresh_token,
      });
      if (error) {
        return { ok: false as const, error: error.message };
      }
      setProfile(res.data.profile ?? null);
      setTenant(res.data.tenant ?? null);
      await refreshProfileBundle();
      return { ok: true as const };
    },
    [refreshProfileBundle],
  );

  const signUp = useCallback(async (payload: AuthSignupPayload) => {
    const res = await invokeAuthApiEnvelope<{
      userId: string;
      companyId: string;
      emailVerificationSent: boolean;
    }>(
      {
        op: "auth.signup",
        tenantName: payload.tenantName,
        industry: payload.industry,
        domainHint: payload.domainHint,
        fullName: payload.fullName,
        email: payload.email,
        password: payload.password,
        inviteToken: payload.inviteToken,
        acceptTerms: payload.acceptTerms,
      },
      { skipAuthHeader: true },
    );
    if (res.error) {
      return { ok: false as const, error: res.error.message };
    }
    return { ok: true as const };
  }, []);

  const ensureProfile = useCallback(async () => {
    const { data: s } = await supabase.auth.getSession();
    if (!s.session?.access_token) return;
    await invokeAuthApiEnvelope<{ created: boolean }>({ op: "profile.ensure" });
    await refreshProfileBundle();
  }, [refreshProfileBundle]);

  const signOut = useCallback(async () => {
    const { data: current } = await supabase.auth.getSession();
    if (current.session?.access_token) {
      try {
        await invokeAuthApiEnvelope({ op: "auth.logout" });
      } catch {
        /* still clear local session */
      }
    }
    await supabase.auth.signOut();
    setProfile(null);
    setTenant(null);
    setProfileBundle(null);
  }, []);

  const resolveInvitation = useCallback(async (token: string) => {
    const res = await invokeAuthApiEnvelope<{
      email: string;
      companyId: string;
      companyName: string | null;
    }>(
      {
        op: "invitations.resolve",
        token,
      },
      { skipAuthHeader: true },
    );
    if (res.error || !res.data) {
      return { ok: false as const, error: res.error?.message ?? "Invalid invite" };
    }
    return {
      ok: true as const,
      email: res.data.email,
      companyName: res.data.companyName ?? undefined,
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user,
      isLoading,
      isConfigured: isSupabaseConfigured,
      profile,
      tenant,
      profileBundle,
      refreshProfileBundle,
      signInWithPassword,
      signUp,
      signOut,
      ensureProfile,
      resolveInvitation,
    }),
    [
      session,
      user,
      isLoading,
      profile,
      tenant,
      profileBundle,
      refreshProfileBundle,
      signInWithPassword,
      signUp,
      signOut,
      ensureProfile,
      resolveInvitation,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}
