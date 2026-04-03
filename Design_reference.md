# Modern Design Best Practices

## Philosophy

Create unique, memorable experiences while maintaining consistency through modern design principles. Every project should feel distinct yet professional, innovative yet intuitive.

---

## Landing Pages & Marketing Sites

### Hero Sections
**Go beyond static backgrounds:**
- Animated gradients with subtle movement
- Particle systems or geometric shapes floating
- Interactive canvas backgrounds (Three.js, WebGL)
- Video backgrounds with proper fallbacks
- Parallax scrolling effects
- Gradient mesh animations
- Morphing blob animations


### Layout Patterns
**Use modern grid systems:**
- Bento grids (asymmetric card layouts)
- Masonry layouts for varied content
- Feature sections with diagonal cuts or curves
- Overlapping elements with proper z-index
- Split-screen designs with scroll-triggered reveals

**Avoid:** Traditional 3-column equal grids

### Scroll Animations
**Engage users as they scroll:**
- Fade-in and slide-up animations for sections
- Scroll-triggered parallax effects
- Progress indicators for long pages
- Sticky elements that transform on scroll
- Horizontal scroll sections for portfolios
- Text reveal animations (word by word, letter by letter)
- Number counters animating into view

**Avoid:** Static pages with no scroll interaction

### Call-to-Action Areas
**Make CTAs impossible to miss:**
- Gradient buttons with hover effects
- Floating action buttons with micro-interactions
- Animated borders or glowing effects
- Scale/lift on hover
- Interactive elements that respond to mouse position
- Pulsing indicators for primary actions

---

## Dashboard Applications

### Layout Structure
**Always use collapsible side navigation:**
- Sidebar that can collapse to icons only
- Smooth transition animations between states
- Persistent navigation state (remember user preference)
- Mobile: drawer that slides in/out
- Desktop: sidebar with expand/collapse toggle
- Icons visible even when collapsed

**Structure:**
```
/dashboard (layout wrapper with sidebar)
  /dashboard/overview
  /dashboard/analytics
  /dashboard/settings
  /dashboard/users
  /dashboard/projects
```

All dashboard pages should be nested inside the dashboard layout, not separate routes.

### Data Tables
**Modern table design:**
- Sticky headers on scroll
- Row hover states with subtle elevation
- Sortable columns with clear indicators
- Pagination with items-per-page control
- Search/filter with instant feedback
- Selection checkboxes with bulk actions
- Responsive: cards on mobile, table on desktop
- Loading skeletons, not spinners
- Empty states with illustrations or helpful text

**Use modern table libraries:**
- TanStack Table (React Table v8)
- AG Grid for complex data
- Data Grid from MUI (if using MUI)

### Charts & Visualizations
**Use the latest charting libraries:**
- Recharts (for React, simple charts)
- Chart.js v4 (versatile, well-maintained)
- Apache ECharts (advanced, interactive)
- D3.js (custom, complex visualizations)
- Tremor (for dashboards, built on Recharts)

**Chart best practices:**
- Animated transitions when data changes
- Interactive tooltips with detailed info
- Responsive sizing
- Color scheme matching design system
- Legend placement that doesn't obstruct data
- Loading states while fetching data

### Dashboard Cards
**Metric cards should stand out:**
- Gradient backgrounds or colored accents
- Trend indicators (↑ ↓ with color coding)
- Sparkline charts for historical data
- Hover effects revealing more detail
- Icon representing the metric
- Comparison to previous period

---

## Color & Visual Design

### Color Palettes
**Create depth with gradients:**
- Primary gradient (not just solid primary color)
- Subtle background gradients
- Gradient text for headings
- Gradient borders on cards
- Elevated surfaces for depth

**Color usage:**
- 60-30-10 rule (dominant, secondary, accent)
- Consistent semantic colors (success, warning, error)
- Accessible contrast ratios (WCAG AA minimum)

### Typography
**Create hierarchy through contrast:**
- Large, bold headings (48-72px for heroes)
- Clear size differences between levels
- Variable font weights (300, 400, 600, 700)
- Letter spacing for small caps
- Line height 1.5-1.7 for body text
- Inter, Poppins, or DM Sans for modern feel

### Shadows & Depth
**Layer UI elements:**
- Multi-layer shadows for realistic depth
- Colored shadows matching element color
- Elevated states on hover
- Neumorphism for special elements (sparingly)

---

## Interactions & Micro-animations

### Button Interactions
**Every button should react:**
- Scale slightly on hover (1.02-1.05)
- Lift with shadow on hover
- Ripple effect on click
- Loading state with spinner or progress
- Disabled state clearly visible
- Success state with checkmark animation

### Card Interactions
**Make cards feel alive:**
- Lift on hover with increased shadow
- Subtle border glow on hover
- Tilt effect following mouse (3D transform)
- Smooth transitions (200-300ms)
- Click feedback for interactive cards

### Form Interactions
**Guide users through forms:**
- Input focus states with border color change
- Floating labels that animate up
- Real-time validation with inline messages
- Success checkmarks for valid inputs
- Error states with shake animation
- Password strength indicators
- Character count for text areas

### Page Transitions
**Smooth between views:**
- Fade + slide for page changes
- Skeleton loaders during data fetch
- Optimistic UI updates
- Stagger animations for lists
- Route transition animations

---

## Mobile Responsiveness

### Mobile-First Approach
**Design for mobile, enhance for desktop:**
- Touch targets minimum 44x44px
- Generous padding and spacing
- Sticky bottom navigation on mobile
- Collapsible sections for long content
- Swipeable cards and galleries
- Pull-to-refresh where appropriate

### Responsive Patterns
**Adapt layouts intelligently:**
- Hamburger menu → full nav bar
- Card grid → stack on mobile
- Sidebar → drawer
- Multi-column → single column
- Data tables → card list
- Hide/show elements based on viewport

---

## Loading & Empty States

### Loading States
**Never leave users wondering:**
- Skeleton screens matching content layout
- Progress bars for known durations
- Animated placeholders
- Spinners only for short waits (<3s)
- Stagger loading for multiple elements
- Shimmer effects on skeletons

### Empty States
**Make empty states helpful:**
- Illustrations or icons
- Helpful copy explaining why it's empty
- Clear CTA to add first item
- Examples or suggestions
- No "no data" text alone

---

## Unique Elements to Stand Out

### Distinctive Features
**Add personality:**
- Custom cursor effects on landing pages
- Animated page numbers or section indicators
- Unusual hover effects (magnification, distortion)
- Custom scrollbars
- Glassmorphism for overlays
- Animated SVG icons
- Typewriter effects for hero text
- Confetti or celebration animations for actions

### Interactive Elements
**Engage users:**
- Drag-and-drop interfaces
- Sliders and range controls
- Toggle switches with animations
- Progress steps with animations
- Expandable/collapsible sections
- Tabs with slide indicators
- Image comparison sliders
- Interactive demos or playgrounds

---

## Consistency Rules

### Maintain Consistency
**What should stay consistent:**
- Spacing scale (4px, 8px, 16px, 24px, 32px, 48px, 64px)
- Border radius values
- Animation timing (200ms, 300ms, 500ms)
- Color system (primary, secondary, accent, neutrals)
- Typography scale
- Icon style (outline vs filled)
- Button styles across the app
- Form element styles

### What Can Vary
**Project-specific customization:**
- Color palette (different colors, same system)
- Layout creativity (grids, asymmetry)
- Illustration style
- Animation personality
- Feature-specific interactions
- Hero section design
- Card styling variations
- Background patterns or textures

---

## Technical Excellence

### Performance
- Optimize images (WebP, lazy loading)
- Code splitting for faster loads
- Debounce search inputs
- Virtualize long lists
- Minimize re-renders
- Use proper memoization

### Accessibility
- Keyboard navigation throughout
- ARIA labels where needed
- Focus indicators visible
- Screen reader friendly
- Sufficient color contrast
- Respect reduced motion preferences

---

## Key Principles

1. **Be Bold** - Don't be afraid to try unique layouts and interactions
2. **Be Consistent** - Use the same patterns for similar functions
3. **Be Responsive** - Design works beautifully on all devices
4. **Be Fast** - Animations are smooth, loading is quick
5. **Be Accessible** - Everyone can use what you build
6. **Be Modern** - Use current design trends and technologies
7. **Be Unique** - Each project should have its own personality
8. **Be Intuitive** - Users shouldn't need instructions


---

# Project-Specific Customizations

**IMPORTANT: This section contains the specific design requirements for THIS project. The guidelines above are universal best practices - these customizations below take precedence for project-specific decisions.**

## User Design Requirements

# User Profile Page Prompt

This prompt is designed to drive an AI development tool to implement a complete, production-ready User Profile Page within a multi-tenant Connected AI Business OS. It enforces the runtime safety rules (null/undefined guards, array checks, proper useState initializations, etc.) and follows the dependency-first implementation order: auth/access control and core data setup before dashboard/analytics tasks when both are present.

---

## User Profile Page

### Overview
The User Profile Page delivers centralized user account management within a tenant context. It encompasses profile details, notification preferences, connected accounts, API keys (where allowed), and an activity snapshot. It ties into User Profile Management and User Authentication features, enabling users to securely manage their identity, authentication methods, and scoped API keys for builders. This page must be robust against null/undefined values and rely on guards and proper typing to prevent runtime crashes in all environments (web, mobile, SSR if applicable).

---

## Page Description (Full Detail)

What this page is:
- A self-service, tenant-scoped User Profile Page that enables users to view and edit their profile, configure notification preferences, manage connected accounts, generate or revoke API keys (when allowed by tenant policy), and review recent activity snapshots.

Goals:
- Allow users to view and update profile details (name, avatar, title/role, contact fields).
- Enable authentication method management (password enablement, SSO/linkage, MFA/2FA toggles).
- Present and manage notification preferences (email, SMS, in-app, frequency toggles).
- List connected accounts (OAuth providers, SSO bindings, external login methods) with revoke/disconnect capability where permitted.
- Manage API keys scoped to builders or tenants (where allowed by policy), including creation, rotation, scoping, and revocation.
- Show an activity snapshot: recent login events, changes to profile/auth/preferences, API key usage, and notable system actions within the tenant context.
- Integrate with User Profile Management and User Authentication flows; respect tenant RBAC to restrict sensitive operations (e.g., API key management, SSO unlinking).

UI elements and how they should look and behave:
- Profile section: avatar upload/replace, displayName, name, title, contact email (read-only vs editable per policy), bio/notes (optional).
- Authentication section: password toggle (enable/disable), SSO bindings, MFA/2FA configuration, backup codes display.
- Notification preferences: a set of on/off toggles grouped by channel (email, in-app, SMS), with per-channel sub-options (frequency, digests).
- Connected accounts: list of linked providers (e.g., Google, GitHub, SSO provider), last used, with actions to revoke/disconnect; policy-driven visibility of revoke actions.
- API Keys (if allowed): card-based UI listing scoped keys, builder scope pills, key value display (masked), creation time, expiration, last used, and actions: copy, rotate/regenerate, revoke, edit scope. Include a security-conscious display so that raw keys are only shown immediately after creation with a secure reveal pattern.
- Activity snapshot: compact timeline or grid with recent events, filters (time range, event type), and export option.
- Visual cues: use the provided design system and color palette for surfaces, typography, borders, and accents; ensure high contrast for primary actions and clear affordances.
- API integrations: all data interactions occur through authenticated API calls; page should not perform client-side data mutations without server validation and optimistic UI guarded with proper fallbacks.

Connected features and data flow:
- User Profile Management: updates to profile fields, auth methods, preferences, and scoped API keys per builder scope.
- User Authentication: login/signup/SSO/session handling in tenant context; ensure changes are reflected in session state where necessary.
- No external API integration required for this page in the current scope, but prepare for future integration hooks (e.g., external identity providers, API key auditing services).

Validation and data integrity:
- All forms must validate inputs with both client-side and server-side validation; implement schema-based validation where possible.
- Ensure that every array operation in the code path is guarded: use (array ?? []).map(...) or Array.isArray(array) ? array.map(...) : [].
- Use data ?? [] when handling Supabase results or similar data sources.
- Validate API responses: const list = Array.isArray(response?.data) ? response.data : [].
- Use optional chaining for nested API responses: obj?.property?.nested.
- Initialize React state with correct types: useState<Type[]>([]) for arrays; useState<ProfileType | null>(null) if single object; prefer concrete defaults.

Accessibility:
- Ensure semantic HTML structure, ARIA attributes for toggles, expandable sections, and actions.
- Keyboard navigability, focus rings on interactive elements, and screen-reader friendly labels.

---

## Components to Build

- UserProfilePage
  - Orchestrates sections and state; coordinates data fetches and mutations.
- ProfileDetailsCard
  - AvatarUploader
  - Name, DisplayName, Title, Email (editable per policy)
  - Bio/Notes
- AuthenticationMethodsCard
  - PasswordToggle
  - SSOBindingsList
  - MFA/2FAConfig
  - Backup codes (readable via secure modal)
- NotificationPreferencesCard
  - ChannelToggleGroup (Email, In-App, SMS)
  - PerChannelOptions (frequency, digest)
- ConnectedAccountsCard
  - ConnectedAccountItem (provider, last used)
  - Revoke/Disconnect action with confirmation
- ApiKeysCard (conditionally rendered if allowed by tenant)
  - ApiKeyCard
    - keyName, scope pills, createdAt, expiresAt, lastUsed
    - copyKey, rotate/regenerate, revoke, edit scope actions
    - secure reveal pattern for the raw key only on creation
- ActivitySnapshotCard
  - ActivityTimeline or ActivityGrid
  - Filters (timeRange, eventType) and export
- Utilities
  - AvatarUploader, ImageCropper (optional)
  - ConfirmDialog
  - Toast / notification system
  - RateLimiter / Debounce for search/filter inputs
- Data Models and Types
  - UserProfile, AuthMethod, NotificationPreferences, ApiKey, ConnectedAccount, ActivityEvent

All components must guard against null/undefined values and rely on defensive programming patterns:
- (data ?? []) and Array.isArray(...) guards where arrays are expected
- useState([]) defaults for array fields
- Optional chaining for nested properties
- Destructure with defaults: const { items = [], count = 0 } = data ?? {}

---

## Implementation Requirements

### Frontend

- Routing
  - Ensure a dedicated route (e.g., /settings/profile or /tenant/profile) with proper RBAC guards.
- UI Components
  - Implement presentational components with the given color palette, typography, and layout guidelines.
  - All interactive elements must have accessible labels and announce state changes to assistive tech.
- State Management
  - Local component state for temporary edits; centralized mutation through API calls (or a state management library if present in the project).
  - Maintain a stable loading/idle state during fetches and mutations.
- API Integration (client)
  - Define a cohesive API client layer to fetch and mutate:
    - GET /tenants/{tenantId}/users/{userId}/profile
    - PATCH /tenants/{tenantId}/users/{userId}/profile
    - GET /tenants/{tenantId}/users/{userId}/auth-methods
    - PATCH /tenants/{tenantId}/users/{userId}/auth-methods
    - GET /tenants/{tenantId}/users/{userId}/notifications
    - PATCH /tenants/{tenantId}/users/{userId}/notifications
    - GET /tenants/{tenantId}/users/{userId}/connections
    - PATCH /tenants/{tenantId}/users/{userId}/connections/{connectionId}
    - GET /tenants/{tenantId}/users/{userId}/api-keys
    - POST /tenants/{tenantId}/users/{userId}/api-keys
    - PATCH /tenants/{tenantId}/users/{userId}/api-keys/{keyId}
    - DELETE /tenants/{tenantId}/users/{userId}/api-keys/{keyId}
    - GET /tenants/{tenantId}/activities?userId={userId}&range={range}
  - Guard API responses: const profile = response?.data ?? {}; const items = Array.isArray(response?.data?.items) ? response.data.items : [].
  - Use null safety in all fetch/mutate logic.

- Validation
  - Client-side validation using schema: required fields, email format, password strength, URL/URI validations for avatar, etc.
  - Server-side validation expectations must be documented elsewhere; UI should surface server errors clearly with user-friendly messages.

- Security
  - Hide API keys by default; reveal only on creation with a secure pattern (temporary reveal window).
  - Ensure sensitive actions (API key rotation, revoke) require confirmation.
  - Respect tenant RBAC: hide or disable actions based on user roles/permissions.

- Performance
  - Lazy load sections if required; debounce filter inputs; batch requests when multiple fields update simultaneously.

### Backend

- Data Models (Database Tables/Schemas)
  - User
    - id (UUID, PK)
    - tenant_id (FK)
    - email (string, unique)
    - display_name (string)
    - name (string)
    - title (string)
    - avatar_url (string)
    - bio (string)
    - created_at, updated_at
    - roles (array<string>)
    - auth_methods (JSON) // metadata about password, SSO providers, MFA
    - preferences (JSON) // notification prefs, UI flags
  - NotificationPreference
    - user_id (FK)
    - channel (enum: email, in_app, sms)
    - enabled (bool)
    - frequency (enum: immediate, daily, weekly)
  - ConnectedAccount
    - id (UUID)
    - user_id (FK)
    - provider (string)
    - last_used_at (timestamp)
    - linked_at (timestamp)
    - revoked (bool)
    - metadata (JSON)
  - ApiKey
    - id (UUID)
    - user_id (FK)
    - tenant_id (FK)
    - name (string)
    - key_hash (string) // store hashed value
    - scope (string) // e.g., builder:xyz
    - created_at, expires_at, last_used_at
    - active (bool)
    - can_view_key (bool) // to support reveal pattern
    - metadata (JSON)
  - ActivityLog
    - id (UUID)
    - user_id (FK)
    - tenant_id (FK)
    - action (string)
    - details (JSON)
    - created_at

- API Layer
  - Implement RESTful routes as listed above with proper authentication and tenant scoping.
  - Ensure input validation schemas server-side; return structured error payloads.
  - Implement RBAC checks for sensitive endpoints (API key management, SSO unlinking, MFA changes).
  - Implement audit logging for significant user changes (profile updates, auth method changes, API key events).

- Security
  - Store API keys securely with hashing; never log raw keys.
  - Rate limit sensitive endpoints to prevent abuse.
  - Ensure all endpoints require valid tenant context and user session.

- Validation
  - Validate required fields; enforce email uniqueness constraints within tenant.
  - Validate API key scopes and lifecycle statuses per tenant policy.

---

## Integration

- Data Flow:
  - On page load, fetch profile, auth methods, notification prefs, connected accounts, API keys (if allowed), and activity snapshot via separate API calls or batched requests.
  - Mutations should reflect optimistic UI when safe, with rollback on server error.
  - All mutations should trigger UI refreshes or re-fetches to ensure data consistency.

- State Management:
  - Centralized data fetching layer with caching where possible.
  - Use React state (or project-appropriate store) to manage UI states: editing flags, loading indicators, success/error toasts.

- Error Handling:
  - Centralized error handler to map server error payloads to user messages.
  - Show contextual inline errors for form fields.

- Accessibility and Internationalization:
  - All UI text should be localization-ready; expose keys for i18n.
  - ARIA labels and roles for complex controls (sliders, toggles, accordions).

---

## User Experience Flow

1. User navigates to the User Profile Page within their tenant.
2. Page loads: profile, auth methods, notification prefs, connected accounts, and API keys (if allowed) are fetched.
3. User edits ProfileDetails:
   - Update display name, title, avatar, bio.
   - Save; show success or inline validation errors.
4. User configures AuthenticationMethods:
   - Toggle password enablement; manage SSO bindings; configure MFA.
   - Save; reflect changes in session/state; handle errors.
5. User updates NotificationPreferences:
   - Turn channels on/off; adjust frequencies.
   - Save; immediate UI feedback.
6. User reviews ConnectedAccounts:
   - Revoke or disconnect providers as allowed; confirm destructive actions.
7. User manages ApiKeys (if allowed):
   - Create a new key with specific builder scope.
   - View the key once on creation; rotate/regenerate or revoke existing keys.
   - Copy secure value to clipboard; key masked after a grace period.
8. User views ActivitySnapshot:
   - Filter by range and event type; export if enabled.
9. All changes reflect in the user session as applicable (e.g., MFA status, SSO bindings).

---

## Build Order & Dependencies (Mandatory)

- Prerequisites:
  - Authentication system in place with tenant-scoped session management.
  - Core User model in place with basic CRUD and roles/permissions support.
  - UI design system implemented (colors, typography, components).
- Blocks:
  - Block 1: Backend APIs for profile, auth methods, notifications, connections, and API keys (CRUD + audit logs).
  - Block 2: RBAC rules and tenant isolation for user profile actions.
  - Block 3: Frontend components for ProfileDetails, AuthMethods, Notifications, Connections, ApiKeys, and ActivitySnapshot with integrated API client.
  - Block 4: State management, error handling, and loading strategies; integration tests.
  - Block 5: Accessibility, i18n, and responsive adaptations; visual QA.
- Sequencing Rule:
  - Auth/access control and core data setup must be completed before dashboard/workspace/analytics tasks when both exist.

---

## Technical Specifications

- Data Models: See above under Data Models and Tables.
- API Endpoints (Examples):
  - GET /tenants/{tenantId}/users/{userId}/profile
  - PATCH /tenants/{tenantId}/users/{userId}/profile
  - GET /tenants/{tenantId}/users/{userId}/auth-methods
  - PATCH /tenants/{tenantId}/users/{userId}/auth-methods
  - GET /tenants/{tenantId}/users/{userId}/notifications
  - PATCH /tenants/{tenantId}/users/{userId}/notifications
  - GET /tenants/{tenantId}/users/{userId}/connections
  - PATCH /tenants/{tenantId}/users/{userId}/connections/{connectionId}
  - GET /tenants/{tenantId}/users/{userId}/api-keys
  - POST /tenants/{tenantId}/users/{userId}/api-keys
  - PATCH /tenants/{tenantId}/users/{userId}/api-keys/{keyId}
  - DELETE /tenants/{tenantId}/users/{userId}/api-keys/{keyId}
  - GET /tenants/{tenantId}/activities?userId={userId}&range={range}
- Security:
  - RBAC checks on sensitive endpoints.
  - Use session-based authentication with token rotation where applicable.
  - API keys stored hashed; keys emitted only on creation; display patterns ensure keys are not exposed broadly.
- Validation:
  - Client-side: form validation with immediate feedback.
  - Server-side: strict schemas; return field-level errors when possible.

---

## Acceptance Criteria

- [ ] All profile fields (name, avatar, displayName, title, bio) can be viewed and edited with successful server persistence; client reflects updates; invalid inputs show contextual errors.
- [ ] Authentication methods can be viewed and updated; SSO bindings and MFA configurations are persisted with proper validation; session state reflects changes.
- [ ] Notification preferences can be toggled per channel with correct frequency options; changes persist and reflect in user settings.
- [ ] Connected accounts list renders accurately; revoke/disconnect actions are available only when permitted and confirmable.
- [ ] API keys exist only if tenant policy allows; create, rotate, revoke actions work; raw key is revealed only at creation; subsequent displays mask the key.
- [ ] Activity snapshot renders recent events with filters; export function (if defined) works; data is aligned to tenant scope.
- [ ] All API responses and data manipulations guard against null/undefined values; array operations are guarded; useState defaults are correct; Supabase-like results use data ?? [].
- [ ] UI adheres to design system colors, typography, spacing, and responsive behavior; accessibility checks pass (keyboard, screen readers, color contrast).
- [ ] End-to-end flow tests validate that dependent data loads in the correct order and that permission constraints block unauthorized actions.

---

## UI/UX Guidelines

Apply the project's design system with fidelity:
- Color Palette, Typography, Spacing, and Grid
- Card design, hover states, focus rings
- Data visualization styling (timelines, simple charts if used in activity)
- Button styles: primary, ghost/secondary, micro-pill tags
- Form controls: inputs, selects, toggles, switches with accessible labels
- Micro-interactions: transitions 120–200ms for state changes
- Live indicators and status dots in neon green (#00D27A)

---

## Visual Style Details (Repeatable Reference)

- Background: #05060A with radial center glow from #071228 to #0B1A2A
- Surface: #0F1720; Inset panels: #0C1116
- Text: Primary copy #F7FAFF; secondary #8FA0B0
- Accent: Headline #9AD0FF; Outline/borders #154E78
- Action: Positive #00D27A
- Grids: Subtle borders at rgba(255,255,255,0.03)
- Primary CTA: White pill with dark text; dark CTAs use white text on dark backgrounds

---

## Development Notes

- Follow the runtime safety rules religiously:
  - Supabase-like results: data ?? []
  - (array ?? []).map(...) or Array.isArray(data) ? data.map(...) : []
  - useState<Type[]>([]) for arrays
  - const list = Array.isArray(response?.data) ? response.data : []
  - Optional chaining for nested response data
  - Destructure with defaults: const { items = [], count = 0 } = response ?? {}
- Enforce dependency-first order: complete auth/access control and core data scaffolding before UI pages like dashboards/workspaces/analytics if both are in scope.

If you need a ready-to-run starter code scaffold (frontend TS/React with a Node/Express or serverless backend), I can provide a structured repository skeleton with type definitions, API client wrappers, and sample test cases aligned to this prompt.

## Implementation Notes

When implementing this project:

1. **Follow Universal Guidelines**: Use the design best practices documented above as your foundation
2. **Apply Project Customizations**: Implement the specific design requirements stated in the "User Design Requirements" section
3. **Priority Order**: Project-specific requirements override universal guidelines when there's a conflict
4. **Color System**: Extract and implement color values as CSS custom properties in RGB format
5. **Typography**: Define font families, sizes, and weights based on specifications
6. **Spacing**: Establish consistent spacing scale following the design system
7. **Components**: Style all Shadcn components to match the design aesthetic
8. **Animations**: Use Motion library for transitions matching the design personality
9. **Responsive Design**: Ensure mobile-first responsive implementation

## Implementation Checklist

- [ ] Review universal design guidelines above
- [ ] Extract project-specific color palette and define CSS variables
- [ ] Configure Tailwind theme with custom colors
- [ ] Set up typography system (fonts, sizes, weights)
- [ ] Define spacing and sizing scales
- [ ] Create component variants matching design
- [ ] Implement responsive breakpoints
- [ ] Add animations and transitions
- [ ] Ensure accessibility standards
- [ ] Validate against user design requirements

---

**Remember: Always reference this file for design decisions. Do not use generic or placeholder designs.**
