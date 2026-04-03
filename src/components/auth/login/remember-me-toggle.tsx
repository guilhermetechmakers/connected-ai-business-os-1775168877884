import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export type RememberMeToggleProps = {
  id: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
};

export function RememberMeToggle({
  id,
  checked,
  onCheckedChange,
  disabled,
  className,
}: RememberMeToggleProps) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Checkbox
        id={id}
        checked={checked}
        disabled={disabled}
        onCheckedChange={(v) => onCheckedChange(v === true)}
        className="border-white/15 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground"
      />
      <Label
        htmlFor={id}
        className="cursor-pointer text-sm font-normal text-muted-foreground"
      >
        Remember me on this device
      </Label>
    </div>
  );
}
