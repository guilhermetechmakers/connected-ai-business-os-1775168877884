import { Bot, Lock } from "lucide-react";
import { useState } from "react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ScopedApiKeyManager } from "@/components/settings/scoped-api-key-manager";

export function AIAndSecuritySettings() {
  const [aiSafeMode, setAiSafeMode] = useState(true);
  const [modelAccessStrict, setModelAccessStrict] = useState(true);

  return (
    <div className="space-y-6">
      <Card className="border-border/80 bg-card/90">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Bot className="h-5 w-5 text-primary" aria-hidden />
            AI governance
          </CardTitle>
          <CardDescription>
            Grounding, action gating, and model access for the AI chat. Tenant-scoped RAG and prompts
            remain enforced by Edge Functions.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border border-border/60 bg-surface-inner px-4 py-3 transition-all duration-150 hover:border-primary/20">
            <div>
              <Label htmlFor="ai-safe">Safe action mode</Label>
              <p className="text-xs text-muted-foreground">
                Require explicit approval for cross-system writes suggested by AI.
              </p>
            </div>
            <Switch id="ai-safe" checked={aiSafeMode} onCheckedChange={setAiSafeMode} />
          </div>
          <div className="flex items-center justify-between rounded-lg border border-border/60 bg-surface-inner px-4 py-3 transition-all duration-150 hover:border-primary/20">
            <div>
              <Label htmlFor="model-strict">Restrict model access by role</Label>
              <p className="text-xs text-muted-foreground">
                Only tenant_admin and integrations_lead may enable advanced models when toggled on.
              </p>
            </div>
            <Switch id="model-strict" checked={modelAccessStrict} onCheckedChange={setModelAccessStrict} />
          </div>
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Lock className="h-4 w-4 text-primary" aria-hidden />
            Vector retrieval and citations stay tenant-isolated with RLS.
          </p>
        </CardContent>
      </Card>

      <ScopedApiKeyManager />
    </div>
  );
}
