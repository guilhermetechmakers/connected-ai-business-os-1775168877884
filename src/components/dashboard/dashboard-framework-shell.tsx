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
import type { DashboardKind, DashboardLayoutJson, DataAdapterContext } from "@/types/dashboard";

export type DashboardFrameworkShellProps = {
  kind: DashboardKind;
  title: string;
  description: string;
  headerActions?: ReactNode;
  roleHint?: ReactNode;
  /** When true, skip `PageHeader` — use `leadingContent` for a custom hero/toolbar (global dashboard). */
  omitHeader?: boolean;
  /** Rendered above the widget grid (e.g. hero, filters, AI bridge). */
  leadingContent?: ReactNode;
  /** Override RBAC lens for widget *definitions* filtering and per-widget access (role preview). */
  visibilityRoles?: string[];
  /** When true, show microcopy that widget visibility uses a simulated role lens. */
  rolePreviewActive?: boolean;
  /** Merged into `DataAdapterContext` for widgets (date range, department scope). */
  dataContextExtras?: Partial<Pick<DataAdapterContext, "dateRange" | "departmentId">>;
};

export function DashboardFrameworkShell({
  kind,
  title,
  description,
  headerActions,
  roleHint,
  omitHeader = false,
  leadingContent,
  visibilityRoles,
  rolePreviewActive = false,
  dataContextExtras,
}: DashboardFrameworkShellProps) {
  const { profile, user, tenant } = useAuth();
  const roles = Array.isArray(profile?.roles) ? profile.roles : [];
  const roleLabel = roles.length > 0 ? roles.join(", ") : "Member";
  const widgetRoles = useMemo(() => {
    const v = visibilityRoles;
    if (Array.isArray(v) && v.length > 0) return v;
    return roles;
  }, [visibilityRoles, roles]);

  const dataContext = useMemo<DataAdapterContext>(
    () => ({
      companyId: tenant?.id ?? null,
      userId: user?.id ?? null,
      roles,
      departmentId: dataContextExtras?.departmentId ?? null,
      dateRange: dataContextExtras?.dateRange ?? null,
    }),
    [
      tenant?.id,
      user?.id,
      roles,
      dataContextExtras?.departmentId,
      dataContextExtras?.dateRange,
    ],
  );

  const defsQ = useDashboardDefinitions();
  const { layoutJson: remoteLayout, layoutId, persist, layoutQuery } = useDashboardLayoutModel(kind);

  const definitions = useMemo(() => {
    const raw = defsQ.data ?? [];
    const list = Array.isArray(raw) ? raw : [];
    return filterVisibleWidgetDefinitions(list, widgetRoles);
  }, [defsQ.data, widgetRoles]);

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
      {omitHeader ? null : (
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
      )}

      {leadingContent}

      {omitHeader ? (
        <div className="flex flex-wrap items-center justify-end gap-2 border-b border-border/40 pb-4">
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
        </div>
      ) : null}

      {roleHint ?? (
        <p className="text-xs uppercase tracking-widest text-muted-foreground">
          Tailored for <span className="text-primary">{roleLabel}</span>
          {rolePreviewActive ? " · role preview active" : ""}
          {isSupabaseConfigured ? " · widget registry + saved layout" : " · offline layout template"}
        </p>
      )}

      <DashboardGrid
        key={layoutId ?? `offline-${kind}`}
        layoutJson={layoutJson}
        definitions={definitions}
        userRoles={widgetRoles}
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
