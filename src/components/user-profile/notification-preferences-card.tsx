import type { Control, FieldPath, FieldValues } from "react-hook-form";

import { NotificationPreferencesEditor } from "@/components/profile/notification-preferences-editor";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const FREQ = [
  { value: "immediate", label: "Immediate" },
  { value: "daily", label: "Daily digest" },
  { value: "weekly", label: "Weekly digest" },
] as const;

export function NotificationPreferencesCard({
  control,
}: {
  control: Control<FieldValues>;
}) {
  return (
    <Card className="border-border/80 bg-card/90 transition-all duration-150 hover:-translate-y-0.5 hover:shadow-card-hover">
      <CardHeader>
        <CardTitle className="text-base">Notification preferences</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <NotificationPreferencesEditor control={control} />
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Channel frequency
          </p>
          <div className="grid gap-4 sm:grid-cols-3">
            <FormField
              control={control}
              name={"chEmailFreq" as FieldPath<FieldValues>}
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-foreground">Email</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger className="bg-surface-inner" aria-label="Email notification frequency">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {(FREQ ?? []).map((f) => (
                        <SelectItem key={f.value} value={f.value}>
                          {f.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormItem>
              )}
            />
            <FormField
              control={control}
              name={"chInAppFreq" as FieldPath<FieldValues>}
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-foreground">In-app</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger className="bg-surface-inner" aria-label="In-app notification frequency">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {(FREQ ?? []).map((f) => (
                        <SelectItem key={f.value} value={f.value}>
                          {f.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormItem>
              )}
            />
            <FormField
              control={control}
              name={"chSmsFreq" as FieldPath<FieldValues>}
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-foreground">SMS</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger className="bg-surface-inner" aria-label="SMS notification frequency">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {(FREQ ?? []).map((f) => (
                        <SelectItem key={f.value} value={f.value}>
                          {f.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormItem>
              )}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
