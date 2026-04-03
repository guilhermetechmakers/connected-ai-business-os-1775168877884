import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { AnimatedPage } from "@/components/animated-page";
import { DashboardEditorPanel } from "@/components/dashboard/dashboard-editor-panel";
import { DashboardGrid } from "@/components/dashboard/dashboard-grid";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/auth-context";
import { filterVisibleWidgetDefinitions } from "@/dashboard/widget-access";
import {
  buildInstancesForSave,
  useDashboardDefinitions,
  useDashboardLayoutModel,
} from "@/hooks/use-dashboard-framework";
import { isSupabaseConfigured } from "@/lib/supabase";
import type { DashboardKind, DashboardLayoutJson } from "@/types/dashboard";

export type DashboardFrameworkShellProps = {
  kind: DashboardKind;
  title: string;
  description: string;
  headerActions?: ReactNode;
  roleHint?: ReactNode;
};

export function DashboardFrameworkShell({
  kind,
  title,
  description,
  headerActions,
  roleHint,
}: DashboardFrameworkShellProps) {
  const { profile, user, tenant } = useAuth();
  const roles = Array.isArray(profile?.roles) ? profile.roles : [];
  const roleLabel = roles.length > 0 ? roles.join(", ") : "Member";

  const dataContext = useMemo(
    () => ({
      companyId: tenant?.id ?? null,
      userId: user?.id ?? null,
      roles,
    }),
    [tenant?.id, user?.id, roles],
  );

  const defsQ = useDashboardDefinitions();
  const { layoutJson: remoteLayout, layoutId, persist, layoutQuery } = useDashboardLayoutModel(kind);

  const definitions = useMemo(() => {
    const raw = defsQ.data ?? [];
    const list = Array.isArray(raw) ? raw : [];
    return filterVisibleWidgetDefinitions(list, roles);
  }, [defsQ.data, roles]);

  const [layoutJson, setLayoutJson] = useState<DashboardLayoutJson>(remoteLayout);
  const [editable, setEditable] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [dashSearch, setDashSearch] = useState("");

  useEffect(() => {
    setLayoutJson(remoteLayout);
  }, [layoutId, layoutQuery.dataUpdatedAt, remoteLayout]);

  const handlePersist = useCallback(
    (payload: { layoutJson: DashboardLayoutJson; instances: ReturnType<typeof buildInstancesForSave> }) => {
      persist({
        layoutJson: payload.layoutJson,
        instances: payload.instances,
      });
    },
    [persist],
  );

  return (
    <AnimatedPage className="space-y-8">
      <PageHeader
        title={title}
        description={description}
        actions={
          <>
            {headerActions}
            <Button
              type="button"
              variant={editable ? "cta" : "outline"}
              size="sm"
              onClick={() => setEditable((v) => !v)}
              className="transition-transform duration-150 hover:scale-[1.02] motion-reduce:hover:scale-100"
              aria-pressed={editable}
            >
              {editable ? "Lock layout" : "Edit layout"}
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => setEditorOpen(true)}>
              Layout & export
            </Button>
          </>
        }
      />

      {roleHint ?? (
        <p className="text-xs uppercase tracking-widest text-muted-foreground">
          Tailored for <span className="text-primary">{roleLabel}</span>
          {isSupabaseConfigured ? " · widget registry + saved layout" : " · offline layout template"}
        </p>
      )}

      <DashboardGrid
        key={layoutId ?? `offline-${kind}`}
        layoutJson={layoutJson}
        definitions={definitions}
        userRoles={roles}
        editable={editable}
        dataContext={dataContext}
        dashSearch={dashSearch}
        onDashSearchChange={setDashSearch}
        onLayoutJsonChange={setLayoutJson}
        onPersist={editable && isSupabaseConfigured ? handlePersist : undefined}
      />

      <DashboardEditorPanel
        open={editorOpen}
        onOpenChange={setEditorOpen}
        dashboardKind={kind}
        layoutJson={layoutJson}
        layoutId={layoutId}
      />
    </AnimatedPage>
  );
}
