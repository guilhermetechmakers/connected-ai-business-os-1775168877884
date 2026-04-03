import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export type EmailFieldProps = {
  id: string;
  value: string;
  onChange: (value: string) => void;
  onBlur: () => void;
  error?: string;
  disabled?: boolean;
  autoComplete?: string;
};

export function EmailField({
  id,
  value,
  onChange,
  onBlur,
  error,
  disabled,
  autoComplete = "email",
}: EmailFieldProps) {
  const errId = error ? `${id}-error` : undefined;

  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="text-foreground">
        Work email
      </Label>
      <Input
        id={id}
        type="email"
        inputMode="email"
        autoComplete={autoComplete}
        disabled={disabled}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        aria-invalid={Boolean(error)}
        aria-describedby={errId}
        className={cn(
          "h-11 border-white/[0.06] bg-surface-inner transition-[box-shadow,transform] duration-150 focus-visible:ring-primary/20",
          error && "border-destructive/60",
        )}
        placeholder="you@company.com"
      />
      {error ? (
        <p id={errId} className="text-xs font-medium text-destructive" role="status">
          {error}
        </p>
      ) : (
        <p className="text-[11px] text-muted-foreground">
          Use the email associated with your tenant workspace.
        </p>
      )}
    </div>
  );
}
