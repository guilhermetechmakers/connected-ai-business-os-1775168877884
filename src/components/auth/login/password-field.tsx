import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export type PasswordFieldProps = {
  id: string;
  value: string;
  onChange: (value: string) => void;
  onBlur: () => void;
  error?: string;
  disabled?: boolean;
  autoComplete?: string;
  /** When true, only the input row is rendered (use an external label row). */
  hideLabel?: boolean;
};

export function PasswordField({
  id,
  value,
  onChange,
  onBlur,
  error,
  disabled,
  autoComplete = "current-password",
  hideLabel = false,
}: PasswordFieldProps) {
  const [showPassword, setShowPassword] = useState(false);
  const errId = error ? `${id}-error` : undefined;
  const toggleId = `${id}-toggle`;

  return (
    <div className="space-y-2">
      {!hideLabel ? (
        <Label htmlFor={id} className="text-foreground">
          Password
        </Label>
      ) : null}
      <div className="relative">
        <Input
          id={id}
          type={showPassword ? "text" : "password"}
          autoComplete={autoComplete}
          disabled={disabled}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          aria-invalid={Boolean(error)}
          aria-describedby={[errId, toggleId].filter(Boolean).join(" ") || undefined}
          className={cn(
            "h-11 border-white/[0.06] bg-surface-inner pr-12 transition-[box-shadow,transform] duration-150 focus-visible:ring-primary/20",
            error && "border-destructive/60",
          )}
        />
        <Button
          type="button"
          id={toggleId}
          variant="ghost"
          size="icon"
          className="absolute right-1 top-1/2 h-9 w-9 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          onClick={() => setShowPassword((s) => !s)}
          aria-pressed={showPassword}
          aria-label={showPassword ? "Hide password" : "Show password"}
          tabIndex={-1}
        >
          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </Button>
      </div>
      {error ? (
        <p id={errId} className="text-xs font-medium text-destructive" role="status">
          {error}
        </p>
      ) : null}
    </div>
  );
}
