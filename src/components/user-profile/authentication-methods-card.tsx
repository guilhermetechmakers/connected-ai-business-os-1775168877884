import { KeyRound } from "lucide-react";

import { SecurityPanel } from "@/components/profile/security-panel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function AuthenticationMethodsCard({
  onRefresh,
}: {
  onRefresh: () => Promise<void>;
}) {
  return (
    <Card className="border-border/80 bg-card/90">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <KeyRound className="h-4 w-4 text-primary" aria-hidden />
          Authentication methods
        </CardTitle>
      </CardHeader>
      <CardContent>
        <SecurityPanel onRefresh={onRefresh} />
      </CardContent>
    </Card>
  );
}
