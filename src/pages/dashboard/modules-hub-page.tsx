import { Link } from "react-router-dom";
import { toast } from "sonner";

import { AnimatedPage } from "@/components/animated-page";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const modules = [
  { name: "Deal desk", version: "1.4.0", status: "installed" },
  { name: "CS health", version: "0.9.2", status: "available" },
  { name: "Hiring ops", version: "2.1.0", status: "available" },
];

export default function ModulesHubPage() {
  return (
    <AnimatedPage className="space-y-8">
      <PageHeader
        title="Internal modules hub"
        description="Catalog, install, configure permissions, and version tenant mini-apps."
        actions={
          <Button variant="cta" asChild>
            <Link to="/dashboard/modules/new">Create module</Link>
          </Button>
        }
      />

      <div className="grid gap-4 md:grid-cols-3">
        {modules.map((m) => (
          <Card
            key={m.name}
            className="border-border/80 bg-card/90 shadow-card transition-all duration-150 hover:-translate-y-1"
          >
            <CardHeader>
              <CardTitle>{m.name}</CardTitle>
              <CardDescription>v{m.version}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {m.status === "installed" ? (
                <Button size="sm" variant="outline" asChild>
                  <Link to="/dashboard/modules/deal-desk/manage">Manage</Link>
                </Button>
              ) : (
                <Dialog>
                  <DialogTrigger asChild>
                    <Button size="sm" variant="cta">
                      Install
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="border-border/80 bg-card">
                    <DialogHeader>
                      <DialogTitle>Install {m.name}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-3 py-2">
                      <div>
                        <Label>Permission mapping</Label>
                        <Input
                          className="mt-1 bg-surface-inner"
                          placeholder="role:module:admin"
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button
                        variant="cta"
                        onClick={() => toast.success("Install queued")}
                      >
                        Confirm install
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </AnimatedPage>
  );
}
