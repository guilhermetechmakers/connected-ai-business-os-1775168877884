import { useAuth } from "@/contexts/auth-context";

export function useIsSuperAdmin(): boolean {
  const { profile } = useAuth();
  const r = Array.isArray(profile?.roles) ? profile.roles : [];
  return r.map((x) => String(x).toLowerCase()).includes("super_admin");
}

/** Cross-tenant read paths (list endpoints, overview) for auditors and super admins. */
export function useIsPrivilegedTenantAdmin(): boolean {
  const { profile } = useAuth();
  const r = Array.isArray(profile?.roles) ? profile.roles : [];
  return r.some((x) => {
    const s = String(x).toLowerCase();
    return (
      s === "super_admin" ||
      s === "compliance_auditor" ||
      s === "auditor"
    );
  });
}
