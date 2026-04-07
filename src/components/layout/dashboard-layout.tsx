import {
  Activity,
  Bot,
  Building2,
  ChevronLeft,
  ChevronRight,
  Gauge,
  LayoutDashboard,
  LogOut,
  Menu,
  Plug,
  Search,
  Settings,
  Shield,
  User,
  Workflow,
  FileBarChart,
  Bell,
  Puzzle,
  Database,
} from "lucide-react";
import { useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/auth-context";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

const navGroups: {
  label: string;
  items: { to: string; label: string; icon: typeof LayoutDashboard }[];
}[] = [
  {
    label: "Overview",
    items: [
      { to: "/dashboard/global", label: "Global dashboard", icon: LayoutDashboard },
      { to: "/dashboard/executive", label: "Executive", icon: Gauge },
    ],
  },
  {
    label: "Operations",
    items: [
      { to: "/dashboard/workflows", label: "Workflows", icon: Workflow },
      { to: "/dashboard/modules", label: "Modules hub", icon: Puzzle },
      { to: "/dashboard/departments", label: "Departments", icon: Building2 },
      { to: "/reports", label: "Reports", icon: FileBarChart },
    ],
  },
  {
    label: "Intelligence",
    items: [
      { to: "/dashboard/ai", label: "AI workspace", icon: Bot },
      { to: "/dashboard/knowledge-base", label: "Knowledge base", icon: Database },
      { to: "/search", label: "Search", icon: Search },
    ],
  },
  {
    label: "Governance",
    items: [
      { to: "/dashboard/notifications", label: "Notifications", icon: Bell },
      { to: "/dashboard/activity", label: "Activity log", icon: Activity },
      { to: "/dashboard/settings", label: "Settings", icon: Settings },
      { to: "/dashboard/settings/profile", label: "Profile", icon: User },
      { to: "/dashboard/admin", label: "Admin console", icon: Shield },
    ],
  },
];

function SidebarNav({ collapsed }: { collapsed: boolean }) {
  const location = useLocation();

  return (
    <ScrollArea className="h-[calc(100vh-5rem)] px-2">
      <nav className="flex flex-col gap-6 py-4">
        {navGroups.map((group) => (
          <div key={group.label}>
            {!collapsed ? (
              <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                {group.label}
              </p>
            ) : null}
            <ul className="space-y-1">
              {group.items.map((item) => {
                const Icon = item.icon;
                const active =
                  item.to === "/dashboard/global"
                    ? location.pathname === "/dashboard" ||
                      location.pathname === "/dashboard/global"
                    : item.to === "/dashboard/admin"
                      ? location.pathname.startsWith("/dashboard/admin")
                      : item.to === "/dashboard/settings"
                        ? location.pathname.startsWith("/dashboard/settings")
                        : item.to === "/dashboard/settings/profile"
                          ? location.pathname.startsWith("/dashboard/settings")
                          : item.to === "/dashboard/departments"
                            ? location.pathname.startsWith("/dashboard/departments") ||
                              location.pathname.startsWith("/departments") ||
                              location.pathname.startsWith("/department/")
                            : item.to === "/reports"
                              ? location.pathname === "/reports" ||
                                location.pathname.startsWith("/reports/")
                              : location.pathname === item.to ||
                                (item.to !== "/search" &&
                                  location.pathname.startsWith(`${item.to}/`));
                return (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      className={cn(
                        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-150",
                        "hover:bg-muted/60 hover:text-foreground",
                        active
                          ? "bg-primary/10 text-primary shadow-sm ring-1 ring-primary/20"
                          : "text-muted-foreground",
                        collapsed && "justify-center px-2",
                      )}
                      title={collapsed ? item.label : undefined}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      {!collapsed ? <span>{item.label}</span> : null}
                    </NavLink>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
        <div className="border-t border-border/60 pt-4">
          <Link
            to="/onboarding/integrations"
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-all duration-150 hover:bg-muted/60 hover:text-foreground",
              collapsed && "justify-center px-2",
            )}
            title={collapsed ? "Integrations" : undefined}
          >
            <Plug className="h-4 w-4 shrink-0" />
            {!collapsed ? <span>Integrations setup</span> : null}
          </Link>
        </div>
      </nav>
    </ScrollArea>
  );
}

export function DashboardLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const { signOut, tenant, isConfigured } = useAuth();
  const navigate = useNavigate();
  const tenantName = tenant?.name ?? null;
  const tenantDomain = tenant?.domain ?? null;

  return (
    <div className="grid-bg min-h-screen">
      <div className="flex min-h-screen">
        <aside
          className={cn(
            "sticky top-0 hidden h-screen shrink-0 border-r border-border/80 bg-card/80 backdrop-blur-md transition-[width] duration-200 md:flex md:flex-col",
            collapsed ? "w-[72px]" : "w-64",
          )}
        >
          <div className="flex h-16 items-center justify-between border-b border-border/80 px-3">
            <Link
              to="/dashboard/global"
              className={cn(
                "flex items-center gap-2 font-display font-bold text-foreground",
                collapsed && "justify-center",
              )}
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/15 text-sm text-primary">
                AI
              </span>
              {!collapsed ? (
                <span className="text-sm tracking-tight">Business OS</span>
              ) : null}
            </Link>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="hidden md:flex"
              onClick={() => setCollapsed((c) => !c)}
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {collapsed ? (
                <ChevronRight className="h-4 w-4" />
              ) : (
                <ChevronLeft className="h-4 w-4" />
              )}
            </Button>
          </div>
          <SidebarNav collapsed={collapsed} />
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border/80 bg-background/80 px-4 backdrop-blur-md md:px-8">
            <div className="flex items-center gap-3 md:hidden">
              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="outline" size="icon" aria-label="Open menu">
                    <Menu className="h-4 w-4" />
                  </Button>
                </SheetTrigger>
                <SheetContent
                  side="left"
                  className="w-72 border-border/80 bg-card p-0"
                >
                  <div className="flex h-16 items-center border-b border-border/80 px-4">
                    <span className="font-display font-bold">Business OS</span>
                  </div>
                  <SidebarNav collapsed={false} />
                </SheetContent>
              </Sheet>
              <span className="font-display text-sm font-semibold">
                Dashboard
              </span>
            </div>
            <div className="hidden items-center gap-2 md:flex">
              <div className="flex items-center gap-2 rounded-full border border-border/80 bg-surface-inner px-3 py-1.5 text-xs text-muted-foreground">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-pulse-live rounded-full bg-success opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
                </span>
                {tenantName ? (
                  <span className="text-foreground/90">
                    <span className="font-medium text-primary">{tenantName}</span>
                    {tenantDomain ? (
                      <span className="text-muted-foreground"> · {tenantDomain}</span>
                    ) : null}{" "}
                    · isolated tenant context
                  </span>
                ) : (
                  <span>Tenant health · All systems operational</span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" asChild>
                <Link to="/search">Search</Link>
              </Button>
              <Button variant="cta" size="sm" asChild>
                <Link to="/dashboard/ai">Open AI</Link>
              </Button>
              {isConfigured ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="hidden sm:inline-flex"
                  onClick={async () => {
                    await signOut();
                    navigate("/login", { replace: true, state: { signedOut: true } });
                  }}
                  aria-label="Sign out"
                >
                  <LogOut className="mr-1 h-4 w-4" />
                  Sign out
                </Button>
              ) : null}
            </div>
          </header>

          <main className="flex-1 px-4 py-8 md:px-12 lg:px-24">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}
