import type { DashboardLayoutJson } from "@/types/dashboard";

export type ChatDashboardRenderWidget = {
  id: string;
  widgetType: string;
  widgetDefinitionId?: string | null;
  config: Record<string, unknown>;
  isVisible: boolean;
  layout: { x: number; y: number; w: number; h: number; minW?: number; minH?: number } | null;
};

export type ChatDashboardRenderModel = {
  payloadVersion: number;
  layoutId: string;
  layoutName: string;
  dashboardKind: "global" | "executive";
  focus: string | null;
  widgetTypes: string[];
  reused: boolean;
  layoutJson: DashboardLayoutJson;
  widgets: ChatDashboardRenderWidget[];
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function asLayoutJson(value: unknown): DashboardLayoutJson | null {
  const rec = asRecord(value);
  if (!rec) return null;
  return rec as unknown as DashboardLayoutJson;
}

type PayloadWidget = {
  id: string;
  widgetType: string;
  widgetDefinitionId?: string | null;
  config?: Record<string, unknown>;
  isVisible?: boolean;
};

function parseWidgets(payload: Record<string, unknown>): PayloadWidget[] {
  const fromWidgets = Array.isArray(payload.widgets) ? payload.widgets : [];
  const fromLegacy = Array.isArray(payload.widgetInstances) ? payload.widgetInstances : [];
  const source = fromWidgets.length > 0 ? fromWidgets : fromLegacy;

  const rows: PayloadWidget[] = [];
  for (const row of source) {
    const rec = asRecord(row);
    if (!rec) continue;
    const id = typeof rec.id === "string" ? rec.id : "";
    if (!id) continue;
    const widgetType = typeof rec.widgetType === "string"
      ? rec.widgetType
      : (typeof rec.widget_type === "string" ? rec.widget_type : "");
    if (!widgetType) continue;
    rows.push({
      id,
      widgetType,
      widgetDefinitionId: typeof rec.widgetDefinitionId === "string"
        ? rec.widgetDefinitionId
        : (typeof rec.widget_definition_id === "string" ? rec.widget_definition_id : null),
      config: asRecord(rec.config) ?? {},
      isVisible: rec.isVisible === false ? false : rec.is_visible === false ? false : true,
    });
  }
  return rows;
}

function parseLayoutFromPayload(payload: Record<string, unknown>): {
  layoutId: string;
  layoutName: string;
  dashboardKind: "global" | "executive";
  layoutJson: DashboardLayoutJson;
} | null {
  const layoutRec = asRecord(payload.layout);
  if (layoutRec) {
    const layoutId = typeof layoutRec.id === "string" ? layoutRec.id : "";
    const layoutName = typeof layoutRec.name === "string" ? layoutRec.name : "";
    const dashboardKind = layoutRec.dashboardKind === "executive" ? "executive" : "global";
    const layoutJson = asLayoutJson(layoutRec.layoutJson);
    if (layoutId && layoutName && layoutJson) {
      return { layoutId, layoutName, dashboardKind, layoutJson };
    }
  }

  const layoutId = typeof payload.layoutId === "string" ? payload.layoutId : "";
  const layoutName = typeof payload.layoutName === "string" ? payload.layoutName : "";
  const dashboardKind = payload.dashboardKind === "executive" ? "executive" : "global";
  const layoutJson = asLayoutJson(payload.layoutJson);
  if (layoutId && layoutName && layoutJson) {
    return { layoutId, layoutName, dashboardKind, layoutJson };
  }

  return null;
}

export function toChatDashboardRenderModel(
  payload: Record<string, unknown> | null,
): ChatDashboardRenderModel | null {
  if (!payload) return null;
  const layout = parseLayoutFromPayload(payload);
  if (!layout) return null;

  const widgets = parseWidgets(payload);
  if (widgets.length === 0) return null;

  const lgLayouts = Array.isArray(layout.layoutJson.layouts?.lg) ? layout.layoutJson.layouts.lg : [];
  const layoutById = new Map<string, { x: number; y: number; w: number; h: number; minW?: number; minH?: number }>();
  for (const item of lgLayouts) {
    if (!item || typeof item !== "object") continue;
    const id = typeof item.i === "string" ? item.i : "";
    if (!id) continue;
    layoutById.set(id, {
      x: typeof item.x === "number" ? item.x : 0,
      y: typeof item.y === "number" ? item.y : 0,
      w: typeof item.w === "number" ? item.w : 6,
      h: typeof item.h === "number" ? item.h : 8,
      minW: typeof item.minW === "number" ? item.minW : undefined,
      minH: typeof item.minH === "number" ? item.minH : undefined,
    });
  }

  const sorted = [...widgets].sort((a, b) => {
    const la = layoutById.get(a.id);
    const lb = layoutById.get(b.id);
    if (!la && !lb) return a.id.localeCompare(b.id);
    if (!la) return 1;
    if (!lb) return -1;
    if (la.y !== lb.y) return la.y - lb.y;
    if (la.x !== lb.x) return la.x - lb.x;
    return a.id.localeCompare(b.id);
  });

  const widgetTypes = sorted.map((w) => w.widgetType);
  const focus = typeof payload.focus === "string" ? payload.focus : null;
  const reused = payload.reused === true;
  const payloadVersion = typeof payload.payloadVersion === "number" ? payload.payloadVersion : 1;

  return {
    payloadVersion,
    layoutId: layout.layoutId,
    layoutName: layout.layoutName,
    dashboardKind: layout.dashboardKind,
    focus,
    widgetTypes,
    reused,
    layoutJson: layout.layoutJson,
    widgets: sorted.map((widget) => ({
      id: widget.id,
      widgetType: widget.widgetType,
      widgetDefinitionId: widget.widgetDefinitionId ?? null,
      config: widget.config ?? {},
      isVisible: widget.isVisible !== false,
      layout: layoutById.get(widget.id) ?? null,
    })),
  };
}

