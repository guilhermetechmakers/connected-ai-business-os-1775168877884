import { useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import {
  Bell,
  Check,
  CheckCheck,
  ChevronDown,
  ExternalLink,
  Filter,
  Loader2,
  Mail,
  Radio,
  RefreshCw,
  Smartphone,
  Trash2,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";

import { AnimatedPage } from "@/components/animated-page";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/contexts/auth-context";
import {
  useBulkNotificationMutation,
  useNotificationsListQuery,
} from "@/hooks/use-notifications";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import type { NotificationChannel, NotificationRow } from "@/types/notifications";

function channelIcon(ch: NotificationChannel) {
  if (ch === "email") return Mail;
  if (ch === "push") return Smartphone;
  return Bell;
}

function relatedHref(row: NotificationRow): string | null {
  const d = row.data;
  if (d && typeof d === "object" && !Array.isArray(d)) {
    const o = d as Record<string, unknown>;
    if (typeof o.href === "string" && o.href.startsWith("/")) return o.href;
    if (typeof o.route === "string" && o.route.startsWith("/")) return o.route;
  }
  if (row.related_item_id) {
    return `/search?q=${encodeURIComponent(row.related_item_id)}`;
  }
  return null;
}

export default function NotificationsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<"all" | "unread" | "read">("all");
  const [channel, setChannel] = useState<NotificationChannel | "all">("all");
  const [sort, setSort] = useState<
    "created_at_desc" | "created_at_asc" | "priority_desc"
  >("created_at_desc");
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [detail, setDetail] = useState<NotificationRow | null>(null);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);
    const fn = () => setReducedMotion(mq.matches);
    mq.addEventListener("change", fn);
    return () => mq.removeEventListener("change", fn);
  }, []);

  const listQuery = useNotificationsListQuery({
    status,
    channel: channel === "all" ? undefined : channel,
    sort,
  });

  const bulk = useBulkNotificationMutation();

  const items = useMemo(() => {
    const raw = listQuery.data;
    return Array.isArray(raw) ? raw : [];
  }, [listQuery.data]);

  const unreadCount = useMemo(
    () =>
      items.filter((n) => !n.read_at && n.status !== "dismissed").length,
    [items],
  );

  useEffect(() => {
    if (!user?.id || !isSupabaseConfigured) return;
    const ch = supabase
      .channel(`notifications-user-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          void queryClient.invalidateQueries({ queryKey: ["notifications"] });
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
  }, [user?.id, queryClient]);

  const toggleSelect = useCallback((id: string, next: boolean) => {
    setSelected((s) => ({ ...s, [id]: next }));
  }, []);

  const selectedIds = useMemo(
    () => Object.entries(selected).filter(([, v]) => v).map(([k]) => k),
    [selected],
  );

  const selectAllVisible = useCallback(() => {
    const next: Record<string, boolean> = {};
    for (const n of items) next[n.id] = true;
    setSelected(next);
  }, [items]);

  const clearSelection = useCallback(() => setSelected({}), []);

  const runBulk = useCallback(
    async (action: "read" | "unread" | "dismiss" | "acknowledge") => {
      if (selectedIds.length === 0) {
        toast.message("Select at least one notification");
        return;
      }
      const result = await bulk.mutateAsync({ ids: selectedIds, action });
      const updated = result?.updated ?? 0;
      toast.success(
        action === "read"
          ? "Marked as read"
          : action === "unread"
            ? "Marked as unread"
            : action === "dismiss"
              ? "Dismissed"
              : "Acknowledged",
        { description: `${updated} updated` },
      );
      clearSelection();
    },
    [bulk, selectedIds, clearSelection],
  );

  return (
    <AnimatedPage className="space-y-8">
      <PageHeader
        title="Notifications"
        description="In-app alerts with filters, bulk actions, realtime updates, and delivery context."
        actions={
          <div className="flex flex-wrap items-center gap-3">
            <span className="relative inline-flex items-center gap-2">
              {!reducedMotion && unreadCount > 0 ? (
                <span
                  className="inline-flex h-2.5 w-2.5 rounded-full bg-success shadow-[0_0_12px_rgb(var(--success))] animate-pulse-live"
                  aria-hidden
                />
              ) : null}
              <Badge variant="outline" className="border-primary/40 text-primary">
                {unreadCount} unread
              </Badge>
            </span>
            <Button variant="outline" size="sm" asChild>
              <Link to="/dashboard/settings">Alert rules & channels</Link>
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => listQuery.refetch()}
              disabled={listQuery.isFetching}
              aria-label="Refresh list"
            >
              <RefreshCw
                className={cn(
                  "h-4 w-4",
                  listQuery.isFetching && "animate-spin",
                )}
              />
            </Button>
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(200px,260px)_1fr]">
        <Card className="h-fit border-border/80 bg-card/90 shadow-card">
          <CardContent className="space-y-4 p-4">
            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
              <Filter className="h-4 w-4 text-primary" aria-hidden />
              Filters
            </div>
            <div className="space-y-2">
              <Label htmlFor="nf-status">Status</Label>
              <Select
                value={status}
                onValueChange={(v) => setStatus(v as typeof status)}
              >
                <SelectTrigger id="nf-status" className="bg-surface-inner">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="unread">Unread</SelectItem>
                  <SelectItem value="read">Read</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="nf-channel">Channel</Label>
              <Select
                value={channel}
                onValueChange={(v) => setChannel(v as typeof channel)}
              >
                <SelectTrigger id="nf-channel" className="bg-surface-inner">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All channels</SelectItem>
                  <SelectItem value="in_app">In-app</SelectItem>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="push">Push</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="nf-sort">Sort</Label>
              <Select
                value={sort}
                onValueChange={(v) => setSort(v as typeof sort)}
              >
                <SelectTrigger id="nf-sort" className="bg-surface-inner">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="created_at_desc">Newest</SelectItem>
                  <SelectItem value="created_at_asc">Oldest</SelectItem>
                  <SelectItem value="priority_desc">Priority</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={selectAllVisible}
              disabled={items.length === 0}
            >
              Select visible
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={clearSelection}
              disabled={selectedIds.length === 0}
            >
              Clear
            </Button>
            <Separator orientation="vertical" className="mx-1 h-6" />
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => runBulk("read")}
              disabled={bulk.isPending || selectedIds.length === 0}
            >
              {bulk.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Check className="mr-2 h-4 w-4" />
              )}
              Mark read
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => runBulk("unread")}
              disabled={bulk.isPending || selectedIds.length === 0}
            >
              <CheckCheck className="mr-2 h-4 w-4" />
              Mark unread
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => runBulk("acknowledge")}
              disabled={bulk.isPending || selectedIds.length === 0}
            >
              Acknowledge
            </Button>
            <Button
              type="button"
              size="sm"
              variant="destructive"
              onClick={() => runBulk("dismiss")}
              disabled={bulk.isPending || selectedIds.length === 0}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Dismiss
            </Button>
          </div>

          <Card className="border-border/80 bg-card/90 shadow-card">
            <CardContent className="p-0">
              {listQuery.isLoading ? (
                <div className="space-y-0 divide-y divide-border/60">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="flex gap-4 px-4 py-4">
                      <Skeleton className="h-5 w-5 rounded bg-surface-inner" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-2/3 bg-surface-inner" />
                        <Skeleton className="h-3 w-1/3 bg-surface-inner" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : items.length === 0 ? (
                <div className="px-6 py-16 text-center">
                  <Radio className="mx-auto h-10 w-10 text-primary/80" aria-hidden />
                  <p className="mt-4 font-medium text-foreground">
                    You&apos;re caught up
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    New alerts appear here in realtime. Tune channels in Settings.
                  </p>
                  <Button className="mt-6" variant="cta" size="sm" asChild>
                    <Link to="/dashboard/settings">Open notification settings</Link>
                  </Button>
                </div>
              ) : (
                <ul className="divide-y divide-border/60">
                  {items.map((n) => {
                    const ChIcon = channelIcon(n.channel);
                    const unread = !n.read_at && n.status !== "dismissed";
                    return (
                      <li key={n.id}>
                        <div
                          className={cn(
                            "flex items-start gap-3 px-4 py-4 transition-all duration-150",
                            "hover:-translate-y-0.5 hover:bg-muted/25 hover:shadow-card",
                            unread && "bg-primary/[0.04]",
                          )}
                        >
                          <Checkbox
                            checked={Boolean(selected[n.id])}
                            onCheckedChange={(c) =>
                              toggleSelect(n.id, c === true)
                            }
                            aria-label={`Select ${n.title}`}
                            className="mt-1"
                          />
                          <div className="mt-0.5 rounded-lg border border-border/50 bg-surface-inner p-1.5">
                            <ChIcon className="h-4 w-4 text-primary" aria-hidden />
                          </div>
                          <button
                            type="button"
                            className="min-w-0 flex-1 text-left"
                            onClick={() => setDetail(n)}
                          >
                            <div className="flex flex-wrap items-center gap-2">
                              <span
                                className={cn(
                                  "font-medium",
                                  unread ? "text-foreground" : "text-muted-foreground",
                                )}
                              >
                                {n.title}
                              </span>
                              <Badge
                                variant="outline"
                                className="text-[10px] uppercase tracking-wide"
                              >
                                {n.channel}
                              </Badge>
                              <Badge
                                variant="outline"
                                className="border-border/60 text-[10px] text-muted-foreground"
                              >
                                {n.status}
                              </Badge>
                              {unread ? (
                                <span className="inline-flex h-2 w-2 rounded-full bg-success shadow-[0_0_8px_rgb(var(--success))]" />
                              ) : null}
                            </div>
                            <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                              {n.message}
                            </p>
                            <p className="mt-2 text-xs text-muted-foreground">
                              {formatDistanceToNow(new Date(n.created_at), {
                                addSuffix: true,
                              })}
                            </p>
                          </button>
                          <div className="flex shrink-0 flex-col gap-1">
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              className="h-8 px-2"
                              onClick={() => setDetail(n)}
                            >
                              Details
                              <ChevronDown className="ml-1 h-3 w-3 opacity-60" />
                            </Button>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Sheet open={Boolean(detail)} onOpenChange={(o) => !o && setDetail(null)}>
        <SheetContent className="flex w-full flex-col border-border/80 bg-card sm:max-w-lg">
          <SheetHeader>
            <SheetTitle className="pr-8 text-foreground">
              {detail?.title ?? "Notification"}
            </SheetTitle>
            <SheetDescription className="text-muted-foreground">
              Payload, channel, and links for audit-friendly follow-up.
            </SheetDescription>
          </SheetHeader>
          {detail ? (
            <div className="mt-4 flex flex-1 flex-col gap-4 overflow-y-auto text-sm">
              <div className="rounded-xl border border-border/60 bg-surface-inner p-4">
                <p className="whitespace-pre-wrap text-foreground">{detail.message}</p>
              </div>
              <div className="grid gap-2 text-muted-foreground">
                <p>
                  <span className="text-foreground">Channel:</span> {detail.channel}
                </p>
                <p>
                  <span className="text-foreground">Type:</span>{" "}
                  {detail.notification_type}
                </p>
                <p>
                  <span className="text-foreground">Status:</span> {detail.status}
                </p>
                {detail.alert_rule_id ? (
                  <p>
                    <span className="text-foreground">Rule:</span>{" "}
                    <Link
                      to="/dashboard/settings"
                      className="text-primary underline-offset-4 hover:underline"
                    >
                      {detail.alert_rule_id}
                    </Link>
                  </p>
                ) : null}
                {detail.related_item_id ? (
                  <p>
                    <span className="text-foreground">Related ID:</span>{" "}
                    <code className="rounded bg-muted px-1 text-xs">
                      {detail.related_item_id}
                    </code>
                  </p>
                ) : null}
              </div>
              <pre className="max-h-48 overflow-auto rounded-xl border border-border/50 bg-background/50 p-3 text-xs text-muted-foreground">
                {JSON.stringify(detail.data ?? {}, null, 2)}
              </pre>
              <div className="mt-auto flex flex-wrap gap-2 pt-2">
                {relatedHref(detail) ? (
                  <Button variant="cta" size="sm" asChild>
                    <Link to={relatedHref(detail)!}>
                      <ExternalLink className="mr-2 h-4 w-4" />
                      Open related
                    </Link>
                  </Button>
                ) : null}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    await bulk.mutateAsync({
                      ids: [detail.id],
                      action: "read",
                    });
                    toast.success("Marked read");
                    setDetail(null);
                  }}
                >
                  <Check className="mr-2 h-4 w-4" />
                  Mark read
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    await bulk.mutateAsync({
                      ids: [detail.id],
                      action: "acknowledge",
                    });
                    toast.success("Acknowledged");
                    setDetail(null);
                  }}
                >
                  Acknowledge
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setDetail(null)}
                >
                  <X className="mr-2 h-4 w-4" />
                  Close
                </Button>
              </div>
            </div>
          ) : null}
        </SheetContent>
      </Sheet>
    </AnimatedPage>
  );
}
