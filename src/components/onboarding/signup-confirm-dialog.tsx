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

type SignupConfirmDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceLabel: string;
  email: string;
  onConfirm: () => void;
  isLoading: boolean;
};

export function SignupConfirmDialog({
  open,
  onOpenChange,
  workspaceLabel,
  email,
  onConfirm,
  isLoading,
}: SignupConfirmDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="border-border/80 bg-card shadow-card">
        <AlertDialogHeader>
          <AlertDialogTitle className="font-display text-xl">Accept invitation?</AlertDialogTitle>
          <AlertDialogDescription className="text-muted-foreground">
            You are joining <span className="font-medium text-foreground">{workspaceLabel}</span> as{" "}
            <span className="font-medium text-foreground">{email}</span>. This consumes the invite and
            creates your admin account pending email verification.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isLoading}>Back</AlertDialogCancel>
          <AlertDialogAction
            disabled={isLoading}
            className="bg-foreground text-background hover:bg-foreground/90"
            onClick={(e) => {
              e.preventDefault();
              onConfirm();
            }}
          >
            {isLoading ? "Submitting…" : "Confirm & create account"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
