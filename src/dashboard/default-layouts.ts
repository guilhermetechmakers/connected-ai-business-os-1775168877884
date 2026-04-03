import type {
  DashboardKind,
  DashboardLayoutJson,
  DashboardWidgetInstanceRow,
} from "@/types/dashboard";

/** Stable UUIDs for offline / pre-bootstrap layouts (no DB). */
const G = {
  search: "a0000001-0000-4000-8000-000000000001",
  kpi: "a0000001-0000-4000-8000-000000000002",
  insight: "a0000001-0000-4000-8000-000000000003",
  gov: "a0000001-0000-4000-8000-000000000004",
  chart: "a0000001-0000-4000-8000-000000000005",
  quick: "a0000001-0000-4000-8000-000000000006",
  act: "a0000001-0000-4000-8000-000000000007",
  alerts: "a0000001-0000-4000-8000-000000000008",
} as const;

const E = {
  brief: "b0000001-0000-4000-8000-000000000001",
  risk: "b0000001-0000-4000-8000-000000000002",
  metrics: "b0000001-0000-4000-8000-000000000003",
  heat: "b0000001-0000-4000-8000-000000000004",
} as const;

function widgetEntry(
  id: string,
  type: string,
  definitionId: string | null,
): [string, { type: string; definitionId: string | null }] {
  return [id, { type, definitionId }];
}

export function getOfflineDefaultLayout(kind: DashboardKind): {
  layoutJson: DashboardLayoutJson;
  instances: DashboardWidgetInstanceRow[];
} {
  if (kind === "executive") {
    const layoutJson: DashboardLayoutJson = {
      breakpoints: { lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 },
      cols: { lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 },
      layouts: {
        lg: [
          { i: E.brief, x: 0, y: 0, w: 8, h: 10, minW: 4, minH: 6 },
          { i: E.risk, x: 8, y: 0, w: 4, h: 10, minW: 3, minH: 6 },
          { i: E.metrics, x: 0, y: 10, w: 12, h: 6, minW: 4, minH: 4 },
          { i: E.heat, x: 0, y: 16, w: 12, h: 8, minW: 4, minH: 4 },
        ],
      },
      widgets: Object.fromEntries([
        widgetEntry(E.brief, "exec_ai_brief", null),
        widgetEntry(E.risk, "risk_pie", null),
        widgetEntry(E.metrics, "exec_metrics", null),
        widgetEntry(E.heat, "dept_heatmap", null),
      ]),
    };
    const now = new Date().toISOString();
    const instances: DashboardWidgetInstanceRow[] = [
      {
        id: E.brief,
        layout_id: "offline",
        widget_definition_id: null,
        widget_type: "exec_ai_brief",
        config: {},
        is_visible: true,
        created_at: now,
        updated_at: now,
      },
      {
        id: E.risk,
        layout_id: "offline",
        widget_definition_id: null,
        widget_type: "risk_pie",
        config: {},
        is_visible: true,
        created_at: now,
        updated_at: now,
      },
      {
        id: E.metrics,
        layout_id: "offline",
        widget_definition_id: null,
        widget_type: "exec_metrics",
        config: {},
        is_visible: true,
        created_at: now,
        updated_at: now,
      },
      {
        id: E.heat,
        layout_id: "offline",
        widget_definition_id: null,
        widget_type: "dept_heatmap",
        config: {},
        is_visible: true,
        created_at: now,
        updated_at: now,
      },
    ];
    return { layoutJson, instances };
  }

  const layoutJson: DashboardLayoutJson = {
    breakpoints: { lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 },
    cols: { lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 },
    layouts: {
      lg: [
        { i: G.search, x: 0, y: 0, w: 12, h: 5, minW: 4, minH: 3 },
        { i: G.kpi, x: 0, y: 5, w: 12, h: 6, minW: 6, minH: 4 },
        { i: G.insight, x: 0, y: 11, w: 12, h: 5, minW: 4, minH: 3 },
        { i: G.gov, x: 0, y: 16, w: 12, h: 9, minW: 4, minH: 4 },
        { i: G.chart, x: 0, y: 25, w: 8, h: 9, minW: 4, minH: 4 },
        { i: G.quick, x: 8, y: 25, w: 4, h: 9, minW: 2, minH: 4 },
        { i: G.act, x: 0, y: 34, w: 6, h: 10, minW: 3, minH: 4 },
        { i: G.alerts, x: 6, y: 34, w: 6, h: 10, minW: 3, minH: 4 },
      ],
    },
    widgets: Object.fromEntries([
      widgetEntry(G.search, "global_search_card", null),
      widgetEntry(G.kpi, "kpi_strip", null),
      widgetEntry(G.insight, "ai_insight", null),
      widgetEntry(G.gov, "ai_governance", null),
      widgetEntry(G.chart, "throughput_chart", null),
      widgetEntry(G.quick, "quick_actions", null),
      widgetEntry(G.act, "activity_stream", null),
      widgetEntry(G.alerts, "alerts_feed", null),
    ]),
  };

  const now = new Date().toISOString();
  const instances: DashboardWidgetInstanceRow[] = [
    mkOfflineInst(G.search, "global_search_card", now),
    mkOfflineInst(G.kpi, "kpi_strip", now),
    mkOfflineInst(G.insight, "ai_insight", now),
    mkOfflineInst(G.gov, "ai_governance", now),
    mkOfflineInst(G.chart, "throughput_chart", now),
    mkOfflineInst(G.quick, "quick_actions", now),
    mkOfflineInst(G.act, "activity_stream", now),
    mkOfflineInst(G.alerts, "alerts_feed", now),
  ];

  return { layoutJson, instances };
}

function mkOfflineInst(
  id: string,
  widget_type: string,
  ts: string,
): DashboardWidgetInstanceRow {
  return {
    id,
    layout_id: "offline",
    widget_definition_id: null,
    widget_type,
    config: {},
    is_visible: true,
    created_at: ts,
    updated_at: ts,
  };
}
