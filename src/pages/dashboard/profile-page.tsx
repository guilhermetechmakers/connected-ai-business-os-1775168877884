import { AnimatedPage } from "@/components/animated-page";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";

export default function ProfilePage() {
  return (
    <AnimatedPage className="space-y-8">
      <PageHeader
        title="Profile"
        description="Personal info, password & 2FA, connected accounts, and scoped API keys."
      />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border-border/80 bg-card/90">
          <CardHeader>
            <CardTitle>Basics</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-xs text-muted-foreground">Display name</p>
              <Input className="mt-1 bg-surface-inner" defaultValue="Jordan Lee" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Email</p>
              <Input
                className="mt-1 bg-surface-inner"
                defaultValue="jordan@acme.com"
                readOnly
              />
            </div>
            <Button variant="cta" size="sm">
              Save profile
            </Button>
          </CardContent>
        </Card>
        <Card className="border-border/80 bg-card/90">
          <CardHeader>
            <CardTitle>Security</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            <Button variant="outline" className="w-full">
              Change password
            </Button>
            <Button variant="outline" className="w-full">
              Enable 2FA
            </Button>
            <Separator />
            <p className="text-xs uppercase tracking-wider">API keys</p>
            <Button variant="secondary" className="w-full">
              Create scoped key
            </Button>
          </CardContent>
        </Card>
      </div>
    </AnimatedPage>
  );
}
