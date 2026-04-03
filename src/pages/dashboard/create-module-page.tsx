import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";

import { CreateModulePanel } from "@/components/modules/create-module-panel";
import { AnimatedPage } from "@/components/animated-page";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/contexts/auth-context";
import {
  useCompanyRolesQuery,
  useCreateModuleMutation,
} from "@/hooks/use-modules";

export default function CreateModulePage() {
  const navigate = useNavigate();
  const { tenant, profile } = useAuth();
  const { data: roleRows = [], isLoading: rolesLoading } =
    useCompanyRolesQuery();
  const createMutation = useCreateModuleMutation();

  const roles = Array.isArray(roleRows) ? roleRows : [];
  const tenantLabel = tenant?.name ?? "Your tenant";
  const userRole =
    Array.isArray(profile?.roles) && profile.roles.length > 0
      ? String(profile.roles[0])
      : "member";

  return (
    <AnimatedPage className="space-y-8">
      <PageHeader
        title="Create module"
        description="Metadata, unified data bindings, UI entry, permissions, and sandbox preview. Initial version 1.0.0 is created on save."
        actions={
          <Button variant="outline" asChild>
            <Link to="/dashboard/modules">Back to hub</Link>
          </Button>
        }
      />

      {rolesLoading ? (
        <div className="grid gap-4 lg:grid-cols-12">
          <Skeleton className="h-[480px] lg:col-span-7" />
          <Skeleton className="h-[420px] lg:col-span-5" />
        </div>
      ) : (
        <CreateModulePanel
          previewContext={{
            tenantLabel,
            userRole,
            department: "All departments",
          }}
          roleOptions={roles}
          isSubmitting={createMutation.isPending}
          onSubmitValid={async (payload) => {
            const created = await createMutation.mutateAsync({
              name: payload.name,
              description: payload.description,
              uiEntry: payload.uiEntry,
              tenantScope: payload.tenantScope,
              tags: payload.tags,
              dataBindings: payload.dataBindings,
              permissions: payload.permissions,
            });
            if (!created) {
              toast.error("Could not create module", {
                description:
                  "Check Supabase configuration, deploy modules-api, run migrations, and ensure your role can create modules.",
              });
              return;
            }
            toast.success("Module created", {
              description: `${created.name} · v1.0.0`,
            });
            navigate(`/dashboard/modules/${created.id}/manage`, {
              replace: true,
            });
          }}
        />
      )}
    </AnimatedPage>
  );
}
