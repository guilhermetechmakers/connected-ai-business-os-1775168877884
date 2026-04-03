import { Bell } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertRulesTab,
  NotificationSchedulesTab,
  NotificationsPreferencesTab,
} from "@/components/settings/notifications-alerts-settings";

export function NotificationsCenterSettings() {
  return (
    <div className="space-y-6">
      <Card className="border-border/80 bg-card/90">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Bell className="h-5 w-5 text-primary" aria-hidden />
            Notifications center
          </CardTitle>
          <CardDescription>
            In-app preferences, alert rules, and scheduled digests. Delivery uses channel secrets configured
            in Edge Functions.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-8">
          <NotificationsPreferencesTab />
          <AlertRulesTab />
          <NotificationSchedulesTab />
        </CardContent>
      </Card>
    </div>
  );
}
