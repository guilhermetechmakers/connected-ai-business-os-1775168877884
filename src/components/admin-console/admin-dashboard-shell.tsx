import {
  Activity,
  ClipboardList,
  Flag,
  Gauge,
  Layers,
  Menu,
  PanelLeft,
  PanelLeftClose,
  Plug,
  ScrollText,
  ServerCog,
  Shield,
  Users,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { NavLink, Outlet } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useAuth } from "@/contexts/auth-context";
import { canUsePrivilegedAdminData } from "@/lib/admin-rbac";
import { cn } from "@/lib/utils";

import { useIsSuperAdmin } from "./admin-role";

const STORAGE_KEY = "admin-console-sidebar-collapsed";

type NavItem = {
  to: string;
  label: string;
  icon: typeof Gauge;
  superOnly?: boolean;
  end?: boolean;
};

const NAV_ITEMS: NavItem[] = [
  { to: "/dashboard/admin/overview", label: "Overview", icon: Gauge, end: true },
  { to: "/dashboard/admin/tenants", label: "Tenants", icon: Users },
  { to: "/dashboard/admin/integrations", label: "Integrations", icon: Plug },
  { to: "/dashboard/admin/activity", label: "Activity log", icon: Activity },
  { to: "/dashboard/admin/audit", label: "Audit trail", icon: ScrollText },
  { to: "/dashboard/admin/provision", label: "Provision", icon: ServerCog, superOnly: true },
  {
    to: "/dashboard/admin/templates",
    label: "System templates",
    icon: Layers,
    superOnly: true,
  },
  {
    to: "/dashboard/admin/onboarding",
    label: "Onboarding templates",
    icon: ClipboardList,
    superOnly: true,
  },
  { to: "/dashboard/admin/flags", label: "Feature flags", icon: Flag, superOnly: true },
  {
    to: "/dashboard/admin/maintenance",
    label: "Maintenance",
    icon: Shield,
    superOnly: true,
  },
];

export function AdminDashboardShell() {
  const { profile } = useAuth();
  const isSuper = useIsSuperAdmin();
  const isPrivileged = canUsePrivilegedAdminData(profile?.roles);
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    try {
      const v = localStorage.getItem(STORAGE_KEY);
      if (v === "1") setCollapsed(true);
    } catch {
      /* ignore */
    }
  }, []);

  const persistCollapsed = useCallback((next: boolean) => {
    setCollapsed(next);
    try {
      localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, []);

  const visibleItems = NAV_ITEMS.filter((item) => !item.superOnly || isSuper);

  const linkClass = ({
    isActive,
  }: {
    isActive: boolean;
  }) =>
    cn(
      "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-150",
      collapsed && "h-10 w-10 justify-center px-0",
      isActive
        ? "border border-primary/25 bg-primary/10 text-foreground shadow-sm"
        : "text-muted-foreground hover:-translate-y-0.5 hover:bg-surface-inner hover:text-foreground",
    );

  const NavList = ({ onNavigate }: { onNavigate?: () => void }) => (
    <nav className="flex flex-col gap-1 p-2" aria-label="Admin console sections">
      {visibleItems.map((item) => {
        const Icon = item.icon;
        return (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={linkClass}
            onClick={() => onNavigate?.()}
          >
            <Icon className="h-4 w-4 shrink-0 text-primary" aria-hidden />
            {!collapsed ? <span className="truncate">{item.label}</span> : null}
          </NavLink>
        );
      })}
    </nav>
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6 lg:flex-row lg:items-start">
      <aside
        className={cn(
          "hidden shrink-0 rounded-xl border border-border/70 bg-card/80 shadow-card transition-[width] duration-200 lg:block",
          collapsed ? "w-[72px]" : "w-60",
        )}
        aria-label="Admin sidebar"
      >
        <div className="flex items-center justify-between gap-2 border-b border-border/60 p-2">
          {!collapsed ? (
            <p className="px-1 text-xs font-semibold uppercase tracking-widest text-primary">
              Console
            </p>
          ) : (
            <span className="sr-only">Console navigation collapsed</span>
          )}
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-8 w-8 shrink-0"
            onClick={() => persistCollapsed(!collapsed)}
            aria-expanded={!collapsed}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? (
              <PanelLeft className="h-4 w-4" />
            ) : (
              <PanelLeftClose className="h-4 w-4" />
            )}
          </Button>
        </div>
        <ScrollArea className="h-[calc(100vh-220px)]">
          <NavList />
        </ScrollArea>
      </aside>

      <div className="flex items-center gap-2 lg:hidden">
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="border-border/70"
              aria-label="Open admin navigation"
            >
              <Menu className="mr-2 h-4 w-4" />
              Sections
            </Button>
          </SheetTrigger>
          <SheetContent
            side="left"
            className="w-[min(100%,280px)] border-border/70 bg-card p-0"
          >
            <SheetHeader className="border-b border-border/60 p-4 text-left">
              <SheetTitle className="font-display text-lg">Admin console</SheetTitle>
            </SheetHeader>
            <ScrollArea className="h-[calc(100vh-120px)]">
              <NavList onNavigate={() => setMobileOpen(false)} />
            </ScrollArea>
          </SheetContent>
        </Sheet>
      </div>

      <div className="min-w-0 flex-1">
        {!isPrivileged ? (
          <p className="mb-4 rounded-lg border border-primary/20 bg-surface-inner/60 px-3 py-2 text-sm text-muted-foreground">
            Assign <code className="text-xs">super_admin</code>,{" "}
            <code className="text-xs">compliance_auditor</code>, or{" "}
            <code className="text-xs">auditor</code> for cross-tenant reads. Some actions
            remain <code className="text-xs">super_admin</code> only.
          </p>
        ) : null}
        <Outlet />
      </div>
    </div>
  );
}
