import { SettingsUsersRolesPanel } from "@/components/settings/settings-users-roles-panel";
import { UsersRoleAssignmentSection } from "@/components/settings/users-role-assignment-section";

export default function SettingsUsersPage() {
  return (
    <div className="space-y-8">
      <SettingsUsersRolesPanel />
      <UsersRoleAssignmentSection />
    </div>
  );
}
