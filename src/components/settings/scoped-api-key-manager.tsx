import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
import { KeyRound, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Skeleton } from "@/components/ui/skeleton";
import {
  useBuilderApiKeysQuery,
  useCreateBuilderApiKeyMutation,
  useRevokeBuilderApiKeyMutation,
} from "@/hooks/use-settings-hub";
import { safeStringArray } from "@/lib/auth-api";

const createSchema = z.object({
  name: z.string().min(1).max(120),
  expiresInDays: z.string().optional(),
});

type CreateForm = z.infer<typeof createSchema>;

const SCOPE_OPTIONS = ["read", "write", "admin", "integrations"] as const;

export function ScopedApiKeyManager() {
  const keysQ = useBuilderApiKeysQuery();
  const createMut = useCreateBuilderApiKeyMutation();
  const revokeMut = useRevokeBuilderApiKeyMutation();
  const [open, setOpen] = useState(false);
  const [scopes, setScopes] = useState<string[]>(["read"]);

  const form = useForm<CreateForm>({
    resolver: zodResolver(createSchema),
    defaultValues: { name: "Builder key", expiresInDays: "" },
  });

  const rows = Array.isArray(keysQ.data) ? keysQ.data : [];

  const toggleScope = (s: string) => {
    setScopes((prev) => {
      const p = Array.isArray(prev) ? prev : [];
      if (p.includes(s)) return p.filter((x) => x !== s);
      return [...p, s];
    });
  };

  return (
    <Card className="border-border/80 bg-card/90">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <KeyRound className="h-5 w-5 text-primary" aria-hidden />
          Builder API keys
        </CardTitle>
        <CardDescription>
          Keys stored in <code className="text-xs">builder_api_keys</code> (hashed). The full secret is
          shown once after creation.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex justify-end">
          <Button type="button" size="sm" variant="cta" onClick={() => setOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            New key
          </Button>
        </div>

        {keysQ.isLoading ? (
          <Skeleton className="h-24 w-full rounded-xl bg-surface-inner" />
        ) : keysQ.isError ? (
          <p className="text-sm text-destructive">
            {keysQ.error instanceof Error ? keysQ.error.message : "Could not load keys"}
          </p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No builder keys yet.</p>
        ) : (
          <ul className="space-y-2">
            {(rows ?? []).map((k) => {
              const sc = safeStringArray(k.scopes);
              return (
                <li
                  key={k.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/60 bg-surface-inner px-3 py-2"
                >
                  <div>
                    <p className="font-medium text-foreground">{k.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {k.key_prefix}… ·{" "}
                      {k.expires_at ? format(new Date(k.expires_at), "PP") : "No expiry"}
                    </p>
                    <p className="text-[10px] uppercase tracking-wide text-primary">
                      {(sc.length ? sc : ["read"]).join(", ")}
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="text-destructive"
                    disabled={revokeMut.isPending}
                    onClick={() =>
                      revokeMut.mutate(k.id, {
                        onSuccess: () => toast.success("Key revoked"),
                        onError: (e: Error) => toast.error(e.message),
                      })
                    }
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </li>
              );
            })}
          </ul>
        )}

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="border-border/80 bg-card">
            <DialogHeader>
              <DialogTitle>Create builder API key</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form
                className="space-y-4"
                onSubmit={form.handleSubmit((vals) => {
                  const days = vals.expiresInDays?.trim()
                    ? Number.parseInt(vals.expiresInDays, 10)
                    : undefined;
                  createMut.mutate(
                    {
                      name: vals.name.trim(),
                      scopes: scopes.length ? scopes : ["read"],
                      expiresInDays: Number.isFinite(days) && days && days > 0 ? days : undefined,
                    },
                    {
                      onSuccess: (data) => {
                        const secret =
                          data && typeof data === "object" && "secret" in data &&
                            typeof (data as { secret?: unknown }).secret === "string"
                            ? (data as { secret: string }).secret
                            : "";
                        toast.success("Key created", {
                          description: secret ? `Copy now: ${secret}` : "Copy the secret from the response.",
                          duration: 25_000,
                        });
                        setOpen(false);
                        form.reset();
                        setScopes(["read"]);
                      },
                      onError: (e: Error) => toast.error(e.message),
                    },
                  );
                })}
              >
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Name</FormLabel>
                      <FormControl>
                        <Input className="bg-surface-inner" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="expiresInDays"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Expires in (days, optional)</FormLabel>
                      <FormControl>
                        <Input className="bg-surface-inner" type="number" min={1} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div>
                  <Label className="text-sm">Scopes</Label>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {(SCOPE_OPTIONS ?? []).map((s) => (
                      <label key={s} className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={scopes.includes(s)}
                          onChange={() => toggleScope(s)}
                          className="h-4 w-4 rounded border-border"
                        />
                        {s}
                      </label>
                    ))}
                  </div>
                </div>
                <DialogFooter>
                  <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" variant="cta" disabled={createMut.isPending}>
                    Create
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
