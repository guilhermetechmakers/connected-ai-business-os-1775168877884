import { useEffect, useMemo, useRef } from "react";
import type { Layout as RglLayout, Layouts as RglLayouts } from "react-grid-layout";
import { Responsive, WidthProvider } from "react-grid-layout";

import { hasWidgetAccess } from "@/dashboard/widget-access";
import { useDebouncedValue } from "@/hooks/use-unified-data";
import {
  buildInstancesForSave,
  definitionByType,
  type DashboardSaveInstance,
} from "@/hooks/use-dashboard-framework";
import type {
  DashboardLayoutJson,
  DashboardWidgetDefinitionRow,
} from "@/types/dashboard";
import type { DataAdapterContext } from "@/types/dashboard";

import { DashboardWidgetBody } from "@/components/dashboard/dashboard-widget-body";
import { DashboardWidgetCard } from "@/components/dashboard/widget-card";

import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";

const ResponsiveGridLayout = WidthProvider(Responsive);

const DEFAULT_BREAKPOINTS = { lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 };
const DEFAULT_COLS = { lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 };

const WIDGET_TITLES: Record<string, string> = {
  global_search_card: "Global search",
  kpi_strip: "KPI overview",
  ai_insight: "AI-assisted insight",
  ai_governance: "AI governance & telemetry",
  throughput_chart: "Cross-system throughput",
  quick_actions: "Quick actions",
  activity_stream: "Recent activity",
  alerts_feed: "Alerts",
  exec_ai_brief: "AI executive brief",
  risk_pie: "Risk scoreboard",
  exec_metrics: "Top-line metrics",
  dept_heatmap: "Cross-department heatmap",
};

export type DashboardGridProps = {
  layoutJson: DashboardLayoutJson;
  definitions: DashboardWidgetDefinitionRow[];
  userRoles: string[];
  editable: boolean;
  dataContext: DataAdapterContext;
  dashSearch: string;
  onDashSearchChange: (v: string) => void;
  onLayoutJsonChange: (next: DashboardLayoutJson) => void;
  onPersist?: (payload: {
    layoutJson: DashboardLayoutJson;
    instances: DashboardSaveInstance[];
  }) => void;
};

export function DashboardGrid({
  layoutJson,
  definitions,
  userRoles,
  editable,
  dataContext,
  dashSearch,
  onDashSearchChange,
  onLayoutJsonChange,
  onPersist,
}: DashboardGridProps) {
  const dirtyRef = useRef(false);
  const debouncedLayout = useDebouncedValue(layoutJson, 850);

  const breakpoints = useMemo(
    () => ({ ...DEFAULT_BREAKPOINTS, ...(layoutJson.breakpoints ?? {}) }),
    [layoutJson.breakpoints],
  );
  const cols = useMemo(() => ({ ...DEFAULT_COLS, ...(layoutJson.cols ?? {}) }), [layoutJson.cols]);

  const layoutsForGrid: RglLayouts = useMemo(() => {
    const raw = layoutJson.layouts ?? {};
    const out: RglLayouts = {};
    for (const key of Object.keys(cols)) {
      const k = key as keyof RglLayouts;
      const items = raw[k as string];
      out[k] = (Array.isArray(items) ? items : []) as RglLayout[];
    }
    return out;
  }, [layoutJson.layouts, cols]);

  useEffect(() => {
    if (!editable || !onPersist || !dirtyRef.current) return;
    onPersist({
      layoutJson: debouncedLayout,
      instances: buildInstancesForSave(debouncedLayout),
    });
    dirtyRef.current = false;
  }, [debouncedLayout, editable, onPersist]);

  const handleLayoutChange = (_layout: RglLayout[], allLayouts: RglLayouts) => {
    if (!editable) return;
    dirtyRef.current = true;
    onLayoutJsonChange({
      ...layoutJson,
      layouts: allLayouts,
    });
  };

  const masterKeys = useMemo(() => {
    for (const k of ["lg", "md", "sm", "xs", "xxs"] as const) {
      const arr = layoutsForGrid[k];
      if (Array.isArray(arr) && arr.length > 0) {
        return arr.map((x) => x.i);
      }
    }
    return [];
  }, [layoutsForGrid]);

  const widgetsMap = layoutJson.widgets ?? {};

  return (
    <div className="dashboard-grid-root min-h-[320px] w-full">
      <ResponsiveGridLayout
        className="layout"
        layouts={layoutsForGrid}
        breakpoints={breakpoints}
        cols={cols}
        rowHeight={36}
        margin={[12, 12]}
        containerPadding={[0, 0]}
        onLayoutChange={handleLayoutChange}
        isDraggable={editable}
        isResizable={editable}
        draggableHandle=".dashboard-drag-handle"
        compactType="vertical"
        preventCollision={false}
      >
        {masterKeys.map((id) => {
          const meta = widgetsMap[id];
          if (!meta?.type) return null;
          const def = definitionByType(definitions, meta.type);
          const allowed = def
            ? hasWidgetAccess(userRoles, def.visibility_rules)
            : true;
          const title =
            def?.name ?? WIDGET_TITLES[meta.type] ?? meta.type.replace(/_/g, " ");

          return (
            <div key={id} className="min-h-0">
              <DashboardWidgetCard title={title} showDragHandle={editable}>
                {allowed ? (
                  <DashboardWidgetBody
                    widgetType={meta.type}
                    definition={def}
                    dataContext={dataContext}
                    dashSearch={dashSearch}
                    onDashSearchChange={onDashSearchChange}
                  />
                ) : (
                  <p className="text-sm text-muted-foreground">
                    This widget is not available for your role.
                  </p>
                )}
              </DashboardWidgetCard>
            </div>
          );
        })}
      </ResponsiveGridLayout>
    </div>
  );
}
