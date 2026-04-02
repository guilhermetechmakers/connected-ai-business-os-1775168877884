import { Route, Routes } from "react-router-dom";

import { ProtectedRoute } from "@/components/auth/protected-route";
import { AppProviders } from "@/components/providers";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import AdminConsolePage from "@/pages/dashboard/admin-console-page";
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
import ProfilePage from "@/pages/dashboard/profile-page";
import ReportsCenterPage from "@/pages/dashboard/reports-center-page";
import SearchPage from "@/pages/dashboard/search-page";
import SettingsPage from "@/pages/dashboard/settings-page";
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
import SuccessPage from "@/pages/success-page";
import TermsPage from "@/pages/terms-page";

export default function App() {
  return (
    <AppProviders>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
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
        <Route element={<ProtectedRoute />}>
          <Route path="/dashboard" element={<DashboardLayout />}>
            <Route index element={<GlobalDashboardPage />} />
            <Route path="executive" element={<ExecutiveDashboardPage />} />
            <Route path="workflows" element={<WorkflowsPage />} />
            <Route path="modules" element={<ModulesHubPage />} />
            <Route path="modules/new" element={<CreateModulePage />} />
            <Route path="modules/:moduleId/manage" element={<EditModulePage />} />
            <Route path="departments" element={<DepartmentsListPage />} />
            <Route path="departments/:deptId" element={<DepartmentWorkspacePage />} />
            <Route path="reports" element={<ReportsCenterPage />} />
            <Route path="ai" element={<AIWorkspacePage />} />
            <Route path="search" element={<SearchPage />} />
            <Route path="notifications" element={<NotificationsPage />} />
            <Route path="activity" element={<ActivityLogPage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="profile" element={<ProfilePage />} />
            <Route path="admin" element={<AdminConsolePage />} />
          </Route>
        </Route>
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </AppProviders>
  );
}
