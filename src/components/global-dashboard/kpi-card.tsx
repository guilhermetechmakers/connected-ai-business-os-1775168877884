import { KPIBlock, type KPIBlockProps } from "@/components/unified-data/kpi-block";

export type KPICardProps = KPIBlockProps;

/** Dashboard KPI tile — wraps shared `KPIBlock` for the global dashboard widget system. */
export function KPICard(props: KPICardProps) {
  return <KPIBlock {...props} />;
}
