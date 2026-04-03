/** Mirrors `profile_has_activity_log_select` in the database (tenant audit readers). */
export function profileCanReadActivityLog(roles: string[] | null | undefined): boolean {
  const list = Array.isArray(roles) ? roles : [];
  const r = list.map((x) => String(x).toLowerCase());
  return r.some((x) =>
    [
      "admin",
      "owner",
      "manager",
      "compliance_auditor",
      "super_admin",
      "auditor",
      "builder",
    ].includes(x),
  );
}

/** Roles that may toggle full (non-redacted) payload in UI when API allows. */
export function profileCanViewFullActivityPayload(
  roles: string[] | null | undefined,
): boolean {
  const list = Array.isArray(roles) ? roles : [];
  const r = list.map((x) => String(x).toLowerCase());
  return r.some((x) =>
    ["admin", "owner", "super_admin", "compliance_auditor", "auditor"].includes(x),
  );
}
