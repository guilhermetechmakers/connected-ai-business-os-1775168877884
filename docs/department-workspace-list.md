# Department Workspace List — integration

## Data flow

1. **Auth**: `useAuth()` supplies `tenant` / `profile.company_id` for query enablement and RBAC (create department requires admin or company admin on the Edge Function).
2. **Fetch**: `useDepartments` → `fetchDepartmentWorkspaceListCatalog()` in `src/lib/departments-workspace-list-api.ts`:
   - Invokes Edge Function `department-workspace-api` with `{ op: "tenants.departments.list" }`.
   - Parses rows with `parseWorkspaceDepartmentList` / `validateDepartmentShape` from `src/lib/department-workspace-list.ts`.
   - Falls back to `fetchTenantDepartmentsDirectory()` (Supabase + `department_members` + `unified_entities`) then maps with `toDepartmentWorkspaceListItem`.
   - If Supabase is not configured, returns deterministic demo rows.
3. **Create**: `createTenantDepartmentWorkspace` invokes `{ op: "tenants.departments.create" }`; on success invalidates React Query `["departments"]`.

## UI entry points

- Route: `/departments` and `/dashboard/departments` → `DepartmentsListPage` → `DepartmentWorkspaceListPage` (`src/components/departments-list/`).
- **Open AI**: links to `/dashboard/departments/:id?tab=ai` (tabs already driven by `useSearchParams` on the workspace page).

## Types

- `DepartmentWorkspaceListItem`, `DepartmentDirectoryRow`: `src/types/department-workspace.ts`.
- DB: `departments` extensions (`department_type`, `workspace_status`, `headcount`, `ai_workspace_enabled`), `department_members` — see `supabase/migrations/20260403140000_department_workspace_list_columns.sql` and `20260403140100_department_members_ai_flag.sql`.

## Acceptance checks

- Lists use `(array ?? []).map` / `Array.isArray` guards in hooks and catalog API.
- Filters and debounced search are client-side on the parsed list.
- Admin-only create is enforced in the Edge Function; UI hides the button for other roles.
