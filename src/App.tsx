import { Navigate, Route, Routes, useParams } from "react-router-dom";

import { AdminRoute } from "@/components/auth/admin-route";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { AppProviders } from "@/components/providers";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import AdminActivityPage from "@/pages/dashboard/admin/admin-activity-page";
import AdminAuditPage from "@/pages/dashboard/admin/admin-audit-page";
import AdminFlagsPage from "@/pages/dashboard/admin/admin-flags-page";
import AdminIntegrationsPage from "@/pages/dashboard/admin/admin-integrations-page";
import AdminOnboardingPage from "@/pages/dashboard/admin/admin-onboarding-page";
import AdminOverviewPage from "@/pages/dashboard/admin/admin-overview-page";
import AdminProvisionPage from "@/pages/dashboard/admin/admin-provision-page";
import AdminTemplatesPage from "@/pages/dashboard/admin/admin-templates-page";
import { AdminDashboardShell } from "@/components/admin-console";
import AdminMaintenancePage from "@/pages/dashboard/admin/admin-maintenance-page";
import AdminTenantsPage from "@/pages/dashboard/admin/admin-tenants-page";
import AIWorkspacePage from "@/pages/dashboard/ai-workspace-page";
import ActivityLogPage from "@/pages/dashboard/activity-log-page";
import CreateModulePage from "@/pages/dashboard/create-module-page";
import DepartmentWorkspacePage from "@/pages/dashboard/department-workspace-page";
import DepartmentsListPage from "@/pages/dashboard/departments-list-page";
import EditModulePage from "@/pages/dashboard/edit-module-page";
import ExecutiveDashboardPage from "@/pages/dashboard/executive-dashboard-page";
import GlobalDashboardPage from "@/pages/dashboard/global-dashboard-page";
import ModulesHubPage from "@/pages/dashboard/modules-hub-page";
import NotificationsPage from "@/pages/dashboard/notifications-page";
import ProfileSettingsPage from "@/pages/dashboard/settings/profile-settings-page";
import ReportsCenterPage from "@/pages/dashboard/reports-center-page";
import SearchPage from "@/pages/dashboard/search-page";
import { SettingsLayout } from "@/components/settings/settings-layout";
import SettingsAiPage from "@/pages/dashboard/settings/ai-page";
import SettingsAuditPage from "@/pages/dashboard/settings/audit-page";
import SettingsBrandingPage from "@/pages/dashboard/settings/branding-page";
import SettingsCompanyPage from "@/pages/dashboard/settings/company-page";
import SettingsDataPoliciesPage from "@/pages/dashboard/settings/data-policies-page";
import SettingsEmailTemplatesPage from "@/pages/dashboard/settings/email-templates-page";
import SettingsFlagsPage from "@/pages/dashboard/settings/flags-page";
import SettingsIntegrationsPage from "@/pages/dashboard/settings/integrations-page";
import SettingsNotificationsPage from "@/pages/dashboard/settings/notifications-page";
import SettingsRolesPage from "@/pages/dashboard/settings/roles-page";
import SettingsUsersPage from "@/pages/dashboard/settings/users-page";
import WorkflowDetailPage from "@/pages/dashboard/workflow-detail-page";
import WorkflowsPage from "@/pages/dashboard/workflows-page";
import CookiesPage from "@/pages/cookies-page";
import CompanySetupPage from "@/pages/company-setup-page";
import EmailVerificationPage from "@/pages/email-verification-page";
import IntegrationSetupPage from "@/pages/integration-setup-page";
import LandingPage from "@/pages/landing-page";
import { LegalPage } from "@/pages/legal-page";
import LoadingPage from "@/pages/loading-page";
import LoginPage from "@/pages/login-page";
import NotFoundPage from "@/pages/not-found-page";
import PasswordResetPage from "@/pages/password-reset-page";
import PrivacyPage from "@/pages/privacy-page";
import ServerErrorPage from "@/pages/server-error-page";
import SignupPage from "@/pages/signup-page";
import SignupInviteAcceptancePage from "@/pages/signup-invite-acceptance-page";
import SuccessPage from "@/pages/success-page";
import TermsPage from "@/pages/terms-page";

function LegacyDepartmentRedirect() {
  const { deptId } = useParams();
  return <Navigate to={deptId ? `/departments/${deptId}` : "/departments"} replace />;
}

export default function App() {
  return (
    <AppProviders>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/404" element={<NotFoundPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/auth/signup-invite" element={<SignupInviteAcceptancePage />} />
        <Route path="/onboarding/signup" element={<SignupInviteAcceptancePage />} />
        <Route path="/password-reset" element={<PasswordResetPage />} />
        <Route path="/verify-email" element={<EmailVerificationPage />} />
        <Route path="/onboarding/company" element={<CompanySetupPage />} />
        <Route path="/onboarding/integrations" element={<IntegrationSetupPage />} />
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="/terms" element={<TermsPage />} />
        <Route path="/cookies" element={<CookiesPage />} />
        <Route
          path="/legal/disclaimer"
          element={
            <LegalPage
              title="Disclaimer"
              body={[
                "This template UI is for development. Production deployments require legal review, DPA, and security assessment.",
              ]}
            />
          }
        />
        <Route path="/loading" element={<LoadingPage />} />
        <Route path="/success" element={<SuccessPage />} />
        <Route path="/error-500" element={<ServerErrorPage />} />
        <Route path="/server-error" element={<ServerErrorPage />} />
        <Route element={<ProtectedRoute />}>
          <Route path="/departments" element={<DashboardLayout />}>
            <Route index element={<DepartmentsListPage />} />
            <Route path=":departmentId" element={<DepartmentWorkspacePage />} />
          </Route>
          <Route path="/dashboard" element={<DashboardLayout />}>
            <Route index element={<Navigate to="global" replace />} />
            <Route path="global" element={<GlobalDashboardPage />} />
            <Route path="executive" element={<ExecutiveDashboardPage />} />
            <Route path="workflows" element={<WorkflowsPage />} />
            <Route path="workflows/:workflowId" element={<WorkflowDetailPage />} />
            <Route path="modules" element={<ModulesHubPage />} />
            <Route path="modules/new" element={<CreateModulePage />} />
            <Route path="modules/:moduleId/manage" element={<EditModulePage />} />
            <Route path="departments" element={<DepartmentsListPage />} />
            <Route path="departments/:departmentId" element={<DepartmentWorkspacePage />} />
            <Route path="ai" element={<AIWorkspacePage />} />
            <Route path="notifications" element={<NotificationsPage />} />
            <Route path="activity" element={<ActivityLogPage />} />
            <Route path="settings" element={<SettingsLayout />}>
              <Route index element={<Navigate to="company" replace />} />
              <Route path="company" element={<SettingsCompanyPage />} />
              <Route path="users" element={<SettingsUsersPage />} />
              <Route path="roles" element={<SettingsRolesPage />} />
              <Route path="integrations" element={<SettingsIntegrationsPage />} />
              <Route path="ai" element={<SettingsAiPage />} />
              <Route path="branding" element={<SettingsBrandingPage />} />
              <Route path="data-policies" element={<SettingsDataPoliciesPage />} />
              <Route path="notifications" element={<SettingsNotificationsPage />} />
              <Route path="audit" element={<SettingsAuditPage />} />
              <Route path="flags" element={<SettingsFlagsPage />} />
              <Route path="email-templates" element={<SettingsEmailTemplatesPage />} />
              <Route path="profile" element={<ProfileSettingsPage />} />
            </Route>
            <Route path="profile" element={<Navigate to="/dashboard/settings/profile" replace />} />
            <Route path="admin" element={<AdminRoute />}>
              <Route element={<AdminDashboardShell />}>
                <Route index element={<Navigate to="overview" replace />} />
                <Route path="overview" element={<AdminOverviewPage />} />
                <Route path="tenants" element={<AdminTenantsPage />} />
                <Route path="integrations" element={<AdminIntegrationsPage />} />
                <Route path="templates" element={<AdminTemplatesPage />} />
                <Route path="onboarding" element={<AdminOnboardingPage />} />
                <Route path="flags" element={<AdminFlagsPage />} />
                <Route path="activity" element={<AdminActivityPage />} />
                <Route path="audit" element={<AdminAuditPage />} />
                <Route path="maintenance" element={<AdminMaintenancePage />} />
                <Route path="provision" element={<AdminProvisionPage />} />
              </Route>
            </Route>
          </Route>
          <Route path="/department/:deptId" element={<LegacyDepartmentRedirect />} />
          <Route path="/reports" element={<DashboardLayout />}>
            <Route index element={<ReportsCenterPage />} />
          </Route>
          <Route path="/search" element={<DashboardLayout />}>
            <Route index element={<SearchPage />} />
          </Route>
        </Route>
        <Route path="/404" element={<NotFoundPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </AppProviders>
  );
}
