import { zodResolver } from "@hookform/resolvers/zod";
import { BookmarkPlus, History, Trash2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { coerceSavedSearchFilters } from "@/lib/search-unified-adapter";
import { cn } from "@/lib/utils";
import type { GlobalSearchFilters } from "@/types/global-search";
import type { SavedSearch } from "@/types/search-results-page";

const saveSchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
});

type SaveForm = z.infer<typeof saveSchema>;

export type SearchSavePanelProps = {
  query: string;
  filters: GlobalSearchFilters;
  saved: SavedSearch[];
  isLoadingSaved?: boolean;
  onSave: (input: { name: string; query: string; filters: GlobalSearchFilters }) => Promise<boolean>;
  onDelete: (id: string) => Promise<boolean>;
  onRunSaved: (saved: SavedSearch) => void;
  className?: string;
};

export function SearchSavePanel({
  query,
  filters,
  saved,
  isLoadingSaved,
  onSave,
  onDelete,
  onRunSaved,
  className,
}: SearchSavePanelProps) {
  const form = useForm<SaveForm>({
    resolver: zodResolver(saveSchema),
    defaultValues: { name: "" },
  });

  const list = Array.isArray(saved) ? saved : [];

  return (
    <Card className={cn("border-border/70 bg-card/90 shadow-card", className)}>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 font-display text-base text-foreground">
          <History className="h-4 w-4 text-primary" />
          Saved searches
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Store the current query and filters for one-click reruns (tenant-scoped, per user).
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <Dialog>
          <DialogTrigger asChild>
            <Button
              type="button"
              variant="cta"
              size="sm"
              className="w-full gap-2 transition-transform duration-150 hover:scale-[1.01] motion-reduce:transition-none motion-reduce:hover:scale-100"
              disabled={query.trim().length < 2}
            >
              <BookmarkPlus className="h-4 w-4" />
              Save current search
            </Button>
          </DialogTrigger>
          <DialogContent className="border-border/80 bg-card sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Save search</DialogTitle>
            </DialogHeader>
            <form
              onSubmit={form.handleSubmit(async (values) => {
                const ok = await onSave({
                  name: values.name,
                  query,
                  filters,
                });
                if (ok) {
                  toast.success("Search saved.");
                  form.reset({ name: "" });
                } else {
                  toast.error("Could not save search.");
                }
              })}
              className="space-y-4"
            >
              <div className="space-y-2">
                <Label htmlFor="saved-search-name">Name</Label>
                <Input
                  id="saved-search-name"
                  className="bg-surface-inner"
                  placeholder="e.g. Q4 pipeline review"
                  {...form.register("name")}
                />
                {form.formState.errors.name?.message ? (
                  <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
                ) : null}
              </div>
              <DialogFooter>
                <Button type="submit" variant="cta" disabled={form.formState.isSubmitting}>
                  {form.formState.isSubmitting ? "Saving…" : "Save"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        <div>
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            Your library
          </p>
          {isLoadingSaved ? (
            <p className="text-xs text-muted-foreground">Loading…</p>
          ) : list.length === 0 ? (
            <p className="text-xs text-muted-foreground">No saved searches yet.</p>
          ) : (
            <ScrollArea className="h-48 pr-2">
              <ul className="space-y-2">
                {list.map((s) => (
                  <li
                    key={s.id}
                    className="flex items-start gap-2 rounded-lg border border-border/60 bg-surface-inner/50 p-2"
                  >
                    <div className="min-w-0 flex-1">
                      <button
                        type="button"
                        className="w-full text-left text-sm font-medium text-foreground hover:text-primary"
                        onClick={() => onRunSaved(s)}
                      >
                        {s.name}
                      </button>
                      <p className="truncate text-[10px] text-muted-foreground">{s.query}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {s.updatedAt
                          ? new Date(s.updatedAt).toLocaleString()
                          : s.createdAt
                            ? new Date(s.createdAt).toLocaleString()
                            : ""}
                      </p>
                    </div>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                      aria-label={`Delete saved search ${s.name}`}
                      onClick={async () => {
                        const ok = await onDelete(s.id);
                        if (ok) toast.success("Removed saved search.");
                        else toast.error("Delete failed.");
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </li>
                ))}
              </ul>
            </ScrollArea>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function applySavedSearchToState(saved: SavedSearch): {
  query: string;
  filters: GlobalSearchFilters;
} {
  return {
    query: typeof saved.query === "string" ? saved.query : "",
    filters: coerceSavedSearchFilters(saved.filters),
  };
}
