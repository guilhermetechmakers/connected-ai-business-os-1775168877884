import type { Control, FieldPath, FieldValues } from "react-hook-form";

import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
} from "@/components/ui/form";
import { Switch } from "@/components/ui/switch";

const CHANNELS = [
  { name: "emailDigest" as const, label: "Email digest", description: "Periodic summaries" },
  { name: "securityAlerts" as const, label: "Security alerts", description: "Sign-ins and credential changes" },
  { name: "productUpdates" as const, label: "Product updates", description: "Release notes and tips" },
  { name: "inAppEnabled" as const, label: "In-app notifications", description: "Bell and workspace toasts" },
  { name: "smsEnabled" as const, label: "SMS (if configured)", description: "Critical alerts to mobile" },
] as const;

export function NotificationPreferencesEditor({ control }: { control: Control<FieldValues> }) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Notification channels
      </p>
      <div className="space-y-2">
        {CHANNELS.map((ch) => (
          <FormField
            key={ch.name}
            control={control}
            name={ch.name as FieldPath<FieldValues>}
            render={({ field }) => (
              <FormItem className="flex flex-row items-center justify-between rounded-xl border border-border/60 bg-surface-inner/50 px-3 py-2 transition-all duration-150 hover:border-primary/25">
                <div className="space-y-0.5 pr-2">
                  <FormLabel className="!mt-0 text-foreground">{ch.label}</FormLabel>
                  <p className="text-[11px] text-muted-foreground">{ch.description}</p>
                </div>
                <FormControl>
                  <Switch checked={field.value} onCheckedChange={field.onChange} />
                </FormControl>
              </FormItem>
            )}
          />
        ))}
      </div>
    </div>
  );
}
