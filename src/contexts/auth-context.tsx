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

const DEMO_SESSION_KEY = "caos_demo_session_v1";

export type DemoSessionPayload = {
  email: string;
  rememberMe: boolean;
  tenantName?: string;
  tenantId?: string;
};

function parseDemoSession(raw: unknown): DemoSessionPayload | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.email !== "string" || typeof o.rememberMe !== "boolean") return null;
  return {
    email: o.email,
    rememberMe: o.rememberMe,
    tenantName: typeof o.tenantName === "string" ? o.tenantName : undefined,
    tenantId: typeof o.tenantId === "string" ? o.tenantId : undefined,
  };
}

function readDemoSessionFromStorage(): DemoSessionPayload | null {
  for (const store of [sessionStorage, localStorage]) {
    try {
      const raw = store.getItem(DEMO_SESSION_KEY);
      if (!raw) continue;
      const parsed = parseDemoSession(JSON.parse(raw) as unknown);
      if (parsed) return parsed;
    } catch {
      /* ignore corrupt storage */
    }
  }
  return null;
}

function persistDemoSession(payload: DemoSessionPayload): void {
  const primary = payload.rememberMe ? localStorage : sessionStorage;
  const secondary = payload.rememberMe ? sessionStorage : localStorage;
  try {
    secondary.removeItem(DEMO_SESSION_KEY);
    primary.setItem(DEMO_SESSION_KEY, JSON.stringify(payload));
  } catch {
    /* quota / private mode */
  }
}

function clearDemoSessionStorage(): void {
  try {
    sessionStorage.removeItem(DEMO_SESSION_KEY);
    localStorage.removeItem(DEMO_SESSION_KEY);
  } catch {
    /* ignore */
  }
}

export type AuthLoginPayload = {
  email: string;
  password: string;
  tenantDomain?: string;
  tenantId?: string;
  rememberMe?: boolean;
};

export type AuthSignupCompanyProfile = {
  timeZone: string;
  currency: string;
  departments: string[];
  integrations: string[];
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
  companyProfile?: AuthSignupCompanyProfile;
};

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  isLoading: boolean;
  isConfigured: boolean;
  demoSession: DemoSessionPayload | null;
  profile: ProfilePayload;
  tenant: TenantPayload;
  profileBundle: ProfileGetData | null;
  refreshProfileBundle: () => Promise<void>;
  signInWithPassword: (
    payload: AuthLoginPayload,
  ) => Promise<{ ok: boolean; error?: string; code?: string }>;
  signInDemo: (payload: DemoSessionPayload) => void;
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
  const [demoSession, setDemoSession] = useState<DemoSessionPayload | null>(() =>
    readDemoSessionFromStorage(),
  );
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
          rememberMe: payload.rememberMe === true,
        },
        { skipAuthHeader: true },
      );
      if (res.error || !res.data?.session) {
        const metaCode =
          res.meta && typeof res.meta === "object" && "code" in res.meta
            ? (res.meta as { code?: unknown }).code
            : undefined;
        return {
          ok: false as const,
          error: res.error?.message ?? "Sign-in failed",
          code:
            typeof res.error?.code === "string"
              ? res.error.code
              : typeof metaCode === "string"
                ? metaCode
                : undefined,
        };
      }
      const { error } = await supabase.auth.setSession({
        access_token: res.data.session.access_token,
        refresh_token: res.data.session.refresh_token,
      });
      if (error) {
        return { ok: false as const, error: error.message };
      }
      try {
        if (payload.rememberMe === true) {
          localStorage.setItem("caos_auth_remember_me", "1");
        } else {
          localStorage.removeItem("caos_auth_remember_me");
        }
      } catch {
        /* storage may be unavailable */
      }
      setProfile(res.data.profile ?? null);
      setTenant(res.data.tenant ?? null);
      await refreshProfileBundle();
      return { ok: true as const };
    },
    [refreshProfileBundle],
  );

  const signInDemo = useCallback((payload: DemoSessionPayload) => {
    persistDemoSession(payload);
    setDemoSession(payload);
  }, []);

  const signUp = useCallback(async (payload: AuthSignupPayload) => {
    const departments = Array.isArray(payload.companyProfile?.departments)
      ? payload.companyProfile!.departments
      : [];
    const integrations = Array.isArray(payload.companyProfile?.integrations)
      ? payload.companyProfile!.integrations
      : [];
    const companyProfile =
      payload.companyProfile &&
      (payload.companyProfile.timeZone ||
        payload.companyProfile.currency ||
        departments.length > 0 ||
        integrations.length > 0)
        ? {
            timeZone: payload.companyProfile.timeZone,
            currency: payload.companyProfile.currency,
            departments,
            integrations,
          }
        : undefined;

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
        ...(companyProfile ? { companyProfile } : {}),
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
    clearDemoSessionStorage();
    setDemoSession(null);
    try {
      localStorage.removeItem("caos_auth_remember_me");
    } catch {
      /* ignore */
    }
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
      demoSession,
      profile,
      tenant,
      profileBundle,
      refreshProfileBundle,
      signInWithPassword,
      signInDemo,
      signUp,
      signOut,
      ensureProfile,
      resolveInvitation,
    }),
    [
      session,
      user,
      isLoading,
      demoSession,
      profile,
      tenant,
      profileBundle,
      refreshProfileBundle,
      signInWithPassword,
      signInDemo,
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
