import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { format } from "date-fns";
import { Copy, KeyRound, Pencil, Plus, RefreshCw } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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

async function copyToClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  } catch {
    toast.error("Could not copy");
  }
}

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
  const [revokeId, setRevokeId] = useState<string | null>(null);
  const [rotateId, setRotateId] = useState<string | null>(null);
  const [editKey, setEditKey] = useState<ApiKeyRow | null>(null);
  const [editScopes, setEditScopes] = useState<string[]>([]);

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
        description: "Copy the secret now — it will not be shown again.",
        duration: 25_000,
      });
      void copyToClipboard(data.secret);
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
      setRevokeId(null);
      await onChanged();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rotateMutation = useMutation({
    mutationFn: async (keyId: string) => {
      return invokeAuthApi<{ secret: string; key: ApiKeyRow }>({
        op: "apikeys.rotate",
        keyId,
      });
    },
    onSuccess: async (data) => {
      setRotateId(null);
      toast.success("Key rotated", {
        description: "New secret copied to clipboard.",
        duration: 20_000,
      });
      void copyToClipboard(data.secret);
      await onChanged();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const patchMutation = useMutation({
    mutationFn: async (payload: { keyId: string; name?: string; scopes: string[] }) => {
      return invokeAuthApi<{ key: ApiKeyRow }>({
        op: "apikeys.patch",
        keyId: payload.keyId,
        name: payload.name,
        scopes: payload.scopes,
      });
    },
    onSuccess: async () => {
      toast.success("Key updated");
      setEditKey(null);
      await onChanged();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function toggleScope(s: string, listScopes: string[], setFn: (v: string[]) => void) {
    const p = Array.isArray(listScopes) ? listScopes : [];
    if (p.includes(s)) setFn(p.filter((x) => x !== s));
    else setFn([...p, s]);
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
              <div className="min-w-0 flex-1">
                <p className="font-medium text-foreground">{k.name}</p>
                <p className="font-mono text-[10px] text-muted-foreground">
                  {k.key_prefix}… · {(safeStringArray(k.scopes).join(", ") || "read")}
                  {k.expires_at ? ` · exp ${format(new Date(k.expires_at), "PP")}` : ""}
                </p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2"
                  aria-label={`Copy masked prefix for ${k.name}`}
                  onClick={() => void copyToClipboard(k.key_prefix)}
                >
                  <Copy className="h-3.5 w-3.5" aria-hidden />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1"
                  disabled={patchMutation.isPending}
                  onClick={() => {
                    setEditKey(k);
                    setEditScopes(safeStringArray(k.scopes).length ? safeStringArray(k.scopes) : ["read"]);
                  }}
                >
                  <Pencil className="h-3 w-3" aria-hidden />
                  Scopes
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1"
                  disabled={rotateMutation.isPending}
                  onClick={() => setRotateId(k.id)}
                >
                  <RefreshCw className="h-3 w-3" aria-hidden />
                  Rotate
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8"
                  onClick={() => setRevokeId(k.id)}
                >
                  Revoke
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <AlertDialog open={rotateId !== null} onOpenChange={(o) => !o && setRotateId(null)}>
        <AlertDialogContent className="border-border/80 bg-card">
          <AlertDialogHeader>
            <AlertDialogTitle>Rotate this API key?</AlertDialogTitle>
            <AlertDialogDescription>
              The current key stops working immediately. You will receive a new secret once.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (rotateId) rotateMutation.mutate(rotateId);
              }}
            >
              Rotate key
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={revokeId !== null} onOpenChange={(o) => !o && setRevokeId(null)}>
        <AlertDialogContent className="border-border/80 bg-card">
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke this API key?</AlertDialogTitle>
            <AlertDialogDescription>
              Integrations using this key will fail immediately. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (revokeId) revokeMutation.mutate(revokeId);
              }}
            >
              Revoke key
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog
        open={editKey !== null}
        onOpenChange={(o) => {
          if (!o) setEditKey(null);
        }}
      >
        <DialogContent className="border-border/80 bg-card sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit scopes</DialogTitle>
          </DialogHeader>
          {editKey ? (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground truncate">{editKey.name}</p>
              <div className="space-y-2">
                <Label>Scopes</Label>
                <div className="flex flex-wrap gap-2">
                  {SCOPE_OPTIONS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      className={cn(
                        "rounded-full border px-3 py-1 text-xs font-medium transition-colors duration-150",
                        editScopes.includes(s)
                          ? "border-primary/50 bg-primary/15 text-primary"
                          : "border-border/60 text-muted-foreground hover:border-primary/30",
                      )}
                      onClick={() => toggleScope(s, editScopes, setEditScopes)}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : null}
          <DialogFooter className="gap-2">
            <Button type="button" variant="ghost" onClick={() => setEditKey(null)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="cta"
              disabled={!editKey || patchMutation.isPending}
              onClick={() => {
                if (!editKey) return;
                patchMutation.mutate({
                  keyId: editKey.id,
                  scopes: editScopes.length ? editScopes : ["read"],
                });
              }}
            >
              Save scopes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
                      onClick={() => toggleScope(s, selectedScopes, setSelectedScopes)}
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
