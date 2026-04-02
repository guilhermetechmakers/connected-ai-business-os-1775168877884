import { Loader2 } from "lucide-react";

export default function LoadingPage() {
  return (
    <div className="grid-bg flex min-h-screen flex-col items-center justify-center gap-4 text-muted-foreground">
      <Loader2 className="h-10 w-10 animate-spin text-primary" />
      <p className="text-sm font-medium">Preparing your workspace…</p>
    </div>
  );
}
