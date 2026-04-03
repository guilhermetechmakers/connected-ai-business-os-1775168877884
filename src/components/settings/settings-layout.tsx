import {
  Bell,
  Building2,
  ClipboardList,
  Flag,
  Layers,
  Mail,
  Palette,
  Plug,
  Shield,
  User,
  Users,
  UserCog,
} from "lucide-react";
import { NavLink, Outlet } from "react-router-dom";

import { PageHeader } from "@/components/layout/page-header";
import { cn } from "@/lib/utils";

const navItems: { to: string; label: string; icon: typeof Building2 }[] = [
  { to: "profile", label: "My profile", icon: User },
  { to: "company", label: "Company profile", icon: Building2 },
  { to: "users", label: "Users", icon: Users },
  { to: "roles", label: "Roles & permissions", icon: UserCog },
  { to: "integrations", label: "Integrations", icon: Plug },
  { to: "ai", label: "AI & security", icon: Shield },
  { to: "branding", label: "Branding", icon: Palette },
  { to: "data-policies", label: "Data policies", icon: Layers },
  { to: "notifications", label: "Notifications", icon: Bell },
  { to: "audit", label: "Audit trail", icon: ClipboardList },
  { to: "flags", label: "Feature flags", icon: Flag },
  { to: "email-templates", label: "Email templates", icon: Mail },
];

export function SettingsLayout() {
  return (
    <div className="space-y-8 animate-fade-in-up motion-reduce:animate-none">
      <PageHeader
        title="Settings"
        description="Tenant governance: company profile, access control, integrations, AI policies, branding, retention, notifications, audit, and staged rollouts."
      />

      <div className="grid gap-8 lg:grid-cols-12 lg:items-start">
        <aside
          className="lg:col-span-3"
          aria-label="Settings sections"
        >
          <nav className="sticky top-24 space-y-1 rounded-2xl border border-border/80 bg-card/90 p-3 shadow-card">
            <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              Configuration
            </p>
            <ul className="space-y-0.5">
              {(navItems ?? []).map((item) => {
                const Icon = item.icon;
                return (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      className={({ isActive }) =>
                        cn(
                          "flex min-h-[44px] items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-150",
                          "hover:bg-muted/50 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                          isActive
                            ? "bg-primary/10 text-primary shadow-sm ring-1 ring-primary/20"
                            : "text-muted-foreground",
                        )
                      }
                    >
                      <Icon className="h-4 w-4 shrink-0" aria-hidden />
                      {item.label}
                    </NavLink>
                  </li>
                );
              })}
            </ul>
          </nav>
        </aside>

        <div className="min-w-0 lg:col-span-9">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
