import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { format } from "date-fns";
import { KeyRound, Plus } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { invokeAuthApi, safeStringArray } from "@/lib/auth-api";
import { cn } from "@/lib/utils";

const createKeySchema = z.object({
  name: z.string().min(2, "Name required").max(120),
  expiresAt: z.string().optional(),
});

type CreateKeyForm = z.infer<typeof createKeySchema>;

const SCOPE_OPTIONS = ["read", "write", "workflows:run", "integrations:sync"] as const;

export type ApiKeyRow = {
  id: string;
  name: string;
  key_prefix: string;
  scopes: string[];
  expires_at?: string | null;
  status?: string;
  created_at: string;
  last_used_at: string | null;
};

export function ApiKeysPanel({
  keys,
  onChanged,
  disabled,
}: {
  keys: ApiKeyRow[];
  onChanged: () => Promise<void>;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [selectedScopes, setSelectedScopes] = useState<string[]>(["read"]);

  const form = useForm<CreateKeyForm>({
    resolver: zodResolver(createKeySchema),
    defaultValues: { name: "", expiresAt: "" },
  });

  const list = Array.isArray(keys) ? keys : [];

  const createMutation = useMutation({
    mutationFn: async (vals: CreateKeyForm & { scopes: string[] }) => {
      const body: Record<string, unknown> = {
        op: "apikeys.create",
        name: vals.name.trim(),
        scopes: vals.scopes.length ? vals.scopes : ["read"],
      };
      if (vals.expiresAt?.trim()) {
        const d = new Date(vals.expiresAt);
        if (!Number.isNaN(d.getTime())) body.expiresAt = d.toISOString();
      }
      return invokeAuthApi<{ secret: string; key: ApiKeyRow }>(body);
    },
    onSuccess: async (data) => {
      toast.success("API key created", {
        description: `Copy the secret now: ${data.secret}`,
        duration: 25_000,
      });
      setOpen(false);
      form.reset();
      setSelectedScopes(["read"]);
      await onChanged();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const revokeMutation = useMutation({
    mutationFn: async (keyId: string) => {
      await invokeAuthApi<{ ok: boolean }>({ op: "apikeys.revoke", keyId });
    },
    onSuccess: async () => {
      toast.success("Key revoked");
      await onChanged();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function toggleScope(s: string) {
    setSelectedScopes((prev) => {
      const p = Array.isArray(prev) ? prev : [];
      if (p.includes(s)) return p.filter((x) => x !== s);
      return [...p, s];
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <KeyRound className="h-3.5 w-3.5 text-primary" aria-hidden />
          Scoped API keys
        </p>
        <Button
          type="button"
          size="sm"
          variant="cta"
          disabled={disabled || createMutation.isPending}
          className="transition-transform duration-150 hover:scale-[1.02]"
          onClick={() => setOpen(true)}
        >
          <Plus className="mr-1.5 h-4 w-4" aria-hidden />
          New key
        </Button>
      </div>
      {list.length === 0 ? (
        <p className="text-sm text-muted-foreground">No active keys. Create one for builder automations.</p>
      ) : (
        <ul className="space-y-2">
          {list.map((k) => (
            <li
              key={k.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/60 bg-surface-inner/40 px-3 py-2"
            >
              <div>
                <p className="font-medium text-foreground">{k.name}</p>
                <p className="font-mono text-[10px] text-muted-foreground">
                  {k.key_prefix}… · {(safeStringArray(k.scopes).join(", ") || "read")}
                  {k.expires_at
                    ? ` · exp ${format(new Date(k.expires_at), "PP")}`
                    : ""}
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={revokeMutation.isPending}
                onClick={() => revokeMutation.mutate(k.id)}
              >
                Revoke
              </Button>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="border-border/80 bg-card sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create API key</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form
              className="space-y-4"
              onSubmit={form.handleSubmit((vals) =>
                createMutation.mutate({ ...vals, scopes: selectedScopes }),
              )}
            >
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Label</FormLabel>
                    <FormControl>
                      <Input className="bg-surface-inner" placeholder="CI / local dev" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="expiresAt"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Expires (optional)</FormLabel>
                    <FormControl>
                      <Input className="bg-surface-inner" type="datetime-local" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="space-y-2">
                <Label>Scopes</Label>
                <div className="flex flex-wrap gap-2">
                  {SCOPE_OPTIONS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      className={cn(
                        "rounded-full border px-3 py-1 text-xs font-medium transition-colors duration-150",
                        selectedScopes.includes(s)
                          ? "border-primary/50 bg-primary/15 text-primary"
                          : "border-border/60 text-muted-foreground hover:border-primary/30",
                      )}
                      onClick={() => toggleScope(s)}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
              <DialogFooter className="gap-2">
                <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" variant="cta" disabled={createMutation.isPending}>
                  Create &amp; reveal secret
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
