import { Sparkles } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export type AISummaryCardProps = {
  summary: string;
  isLoading?: boolean;
  onRefresh?: () => void;
  className?: string;
};

export function AISummaryCard({
  summary,
  isLoading,
  onRefresh,
  className,
}: AISummaryCardProps) {
  return (
    <Card className={cn("border-border/80 bg-card/90 shadow-card", className)}>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" aria-hidden />
          <CardTitle className="text-base">AI-assisted summary</CardTitle>
        </div>
        <Badge variant="outline" className="text-[10px] uppercase">
          tenant-scoped
        </Badge>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          <div className="space-y-2" aria-busy="true">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        ) : (
          <p className="prose prose-invert max-w-none text-sm leading-relaxed text-muted-foreground">
            {summary || "Select a result or run search to generate a summary."}
          </p>
        )}
        {onRefresh ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="transition-transform duration-150 hover:scale-[1.02]"
            onClick={onRefresh}
            disabled={isLoading}
            aria-label="Refresh AI summary"
          >
            Refresh summary
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}
