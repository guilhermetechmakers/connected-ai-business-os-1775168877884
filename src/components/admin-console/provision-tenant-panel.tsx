import { useState } from "react";
import { toast } from "sonner";

import { AdminTenantProvisionWizard } from "@/components/tenancy/admin-tenant-provision-wizard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAdminTenantCreateMutation } from "@/hooks/use-activity-logs";

export function ProvisionTenantPanel() {
  const tenantCreate = useAdminTenantCreateMutation();
  const [tenantName, setTenantName] = useState("");
  const [tenantDomain, setTenantDomain] = useState("");

  return (
    <div className="space-y-6">
      <AdminTenantProvisionWizard />
      <Card className="border-border/80 bg-card/90">
        <CardHeader>
          <CardTitle>Create tenant</CardTitle>
          <p className="text-sm text-muted-foreground">
            Inserts a company row and logs an admin_action entry for the new tenant.
          </p>
        </CardHeader>
        <CardContent className="max-w-lg space-y-4">
          <div className="space-y-2">
            <Label htmlFor="tn">Company name</Label>
            <Input
              id="tn"
              value={tenantName}
              onChange={(e) => setTenantName(e.target.value)}
              className="bg-input border-border/60"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="td">Domain hint (optional)</Label>
            <Input
              id="td"
              value={tenantDomain}
              onChange={(e) => setTenantDomain(e.target.value)}
              className="bg-input border-border/60"
            />
          </div>
          <Button
            type="button"
            variant="cta"
            disabled={tenantCreate.isPending || !tenantName.trim()}
            onClick={() => {
              void tenantCreate
                .mutateAsync({
                  name: tenantName.trim(),
                  domain: tenantDomain.trim() || undefined,
                })
                .then((res) => {
                  if (res) {
                    toast.success(`Tenant ${res.name} created`);
                    setTenantName("");
                    setTenantDomain("");
                  } else toast.error("Create failed");
                });
            }}
          >
            {tenantCreate.isPending ? "Creating…" : "Create tenant"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
