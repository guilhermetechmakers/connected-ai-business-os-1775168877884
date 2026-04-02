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

# Connected AI Business OS - Development Blueprint

## Project Concept
The Connected AI Business OS is a multi-tenant internal business operations platform that sits as an orchestration, intelligence, and execution layer on top of a company's existing SaaS stack. Its purpose is to connect disparate tools (CRM, PM, finance, docs, chat, calendars), normalize and centralize operational context, and provide dashboards, workflows, reporting, and an AI assistant that is grounded in tenant-specific data and actions. The vision is a reusable platform template that enables leadership and teams to operate with unified visibility, automated cross-system execution, and contextual AI assistance without replacing existing software.

AI app description: Role-aware conversational AI with retrieval-augmented generation (RAG) that can answer questions, generate summaries and reports, and propose or execute permitted actions via workflows or integration connectors. Conversations are audited and all AI outputs are scoped by tenant and role.

## Problem Statement
- Core problems:
  - Fragmented operational data across multiple tools causing lack of visibility and coordination.
  - Manual, error-prone cross-tool workflows and repetitive operations.
  - Difficulty for leadership to get concise, contextual executive summaries and risk detection.
  - Long time-to-value for internal modules and inconsistent multi-tenant onboarding.
  - Safety and access concerns when introducing AI-driven actions across systems.

- Who experiences these problems:
  - CEOs, COOs, managers, team members, admins, and internal builders in SMB and mid-market companies.

- Why these problems matter:
  - Slower decision-making, duplicated work, missed revenue/opportunity, operational risk, and high engineering costs to customise internal tooling per client.

- Current state / gaps:
  - No centralized orchestration layer that preserves existing tools while providing unified entities, workflows, and tenant-grounded AI.
  - Limited role-aware AI that uses company context and enforces permissioned actions.

## Solution
- How application addresses problems:
  - Provide a multi-tenant orchestration platform that connects integrations, ingests and normalizes data into a unified data layer, exposes dashboards and department workspaces, runs cross-system workflows, and offers an AI Workspace that reasons from tenant data.
  - Offer reusable modules and templates to accelerate client onboarding and reduce rebuild cost.
  - Enforce role-aware permissions and AI action gating to ensure safety.

- Approach & methodology:
  - Modular architecture (integration adapters, unified data models, workflow engine, AI layer) with tenant scoping at every layer.
  - Retrieval-augmented generation for AI with vector store for document/knowledge retrieval and source citation.
  - Widget-driven dashboards, module registry for mini-apps, and a visual workflow builder with action adapters.
  - Strong observability, retry/error handling, and audit trails.

- Key differentiators:
  - AI grounded in per-tenant context with permission checks and actionable workflows.
  - Reusable multi-tenant template oriented toward fast client onboarding and extensibility.
  - Integration-first orchestration with mapping, sync logs, and health indicators.

- Value creation:
  - Faster decisions for executives, less manual cross-tool work for teams, consistent onboarding for clients, and safe AI-assisted execution that reduces human error.

## Requirements

### 1. Pages (UI Screens)
For each page: Purpose, key sections/components, contribution to solving the problem.

- Sign Up / Invite Acceptance Page
  - Purpose: Tenant creation or invite acceptance; initial admin onboarding.
  - Key sections: Tenant name & domain suggestion, admin fields (name, email, password), invite token processing, Terms checkbox, CTA, progress indicator.
  - Contribution: Lowers friction to onboard tenants and seed the admin user.

- Password Reset Page
  - Purpose: Secure password reset flow.
  - Key sections: Request form (email), reset form (token, new password, confirm, strength meter), success screen.
  - Contribution: Secure account recovery and compliance.

- Email Verification Page
  - Purpose: Confirm email ownership before onboarding.
  - Key sections: Success/failure states, resend link, next-step CTA.
  - Contribution: Ensures verified accounts and secure onboarding.

- Company Setup (Onboarding)
  - Purpose: Initial tenant configuration.
  - Key sections: Company profile, timezone & currency, logo upload, department templates, suggested integrations with connect buttons.
  - Contribution: Accelerates first-week value and configures tenant context.

- Landing Page (Public)
  - Purpose: Marketing, feature overview, pricing, and demo CTAs.
  - Key sections: Hero, feature highlights, testimonials, pricing, resource footer.
  - Contribution: Drives signups and sales.

- Login Page
  - Purpose: Secure sign-in including SSO.
  - Key sections: Email/password, OAuth/SAML buttons, tenant-aware microcopy, forgot password.
  - Contribution: Secure and flexible authentication for enterprises.

- Integration Connection Setup (Onboarding)
  - Purpose: Connect first integrations and map sample data.
  - Key sections: Integration catalog, connect buttons, mapping wizard, test & sync controls, health indicators.
  - Contribution: Hooks tenant systems into the OS to power unified data.

- Global Dashboard
  - Purpose: High-level landing with aggregated KPIs, alerts, activity, and quick actions.
  - Key sections: Widget grid, KPI cards, trend charts, quick actions, filters, sidebar.
  - Contribution: Single-pane-of-glass reducing fragmentation.

- Executive Dashboard
  - Purpose: High-level executive view & AI brief.
  - Key sections: Top-line KPIs, risk scoreboard, AI executive brief card, cross-department heatmap.
  - Contribution: Rapid strategic insights and prioritized actions.

- Workflows / Automations
  - Purpose: Build/test/run workflows across systems.
  - Key sections: Visual canvas/wizard (triggers/conditions/actions), library, execution log, approval config.
  - Contribution: Automates cross-tool actions and reduces manual operations.

- Internal Modules Hub
  - Purpose: Registry and management of tenant mini-apps.
  - Key sections: Catalog, install/config modal, permissions mapping, versioning.
  - Contribution: Reusable internal apps accelerate operations.

- Department Workspace List
  - Purpose: Overview of department workspaces.
  - Key sections: Department cards with KPIs, search/filter, create department.
  - Contribution: Departmental organization and fast access.

- Single Department Workspace
  - Purpose: Department-specific operations and AI.
  - Key sections: Header (lead, KPIs), tabs (Overview, Metrics, Tasks, Reports, Docs, AI Assistant), task list, documents.
  - Contribution: Scoped context and AI for department workflows.

- Reports Center
  - Purpose: Create, view, schedule, export reports.
  - Key sections: Report list, create wizard, detail view with charts and AI summary, schedule manager.
  - Contribution: Data-driven decisions and reporting automation.

- AI Workspace
  - Purpose: Conversational AI scoped to tenant data capable of actions.
  - Key sections: Chat panel, mode selector (Ask/Analyze/Report/Action), context panel (sources), action drawer (permission checks), conversation history.
  - Contribution: Fast insights, summarization, and controlled action execution.

- Search Results Page
  - Purpose: Global permission-aware search.
  - Key sections: Search bar with autosuggest, filters, results list, preview pane, AI-summary option.
  - Contribution: Rapid retrieval of contextual information across systems.

- Notifications Center
  - Purpose: Manage in-app alerts and notification preferences.
  - Key sections: Notification list, filters, bulk actions, rule management link.
  - Contribution: Keeps teams informed and responsive.

- Activity Log
  - Purpose: Tenant-scoped audit and troubleshooting.
  - Key sections: Chronological stream, filters, entry detail modal, export.
  - Contribution: Compliance, observability, and issue investigation.

- Settings / Preferences
  - Purpose: Tenant & user configuration.
  - Key sections: Company settings, users & roles, integrations, AI settings, branding, data policies, feature flags.
  - Contribution: Tenant governance and customization.

- User Profile Page
  - Purpose: Manage user preferences and auth methods.
  - Key sections: Profile info, password & 2FA, connected accounts, API keys.
  - Contribution: User-level security and builder access.

- Admin Console (Internal)
  - Purpose: Platform admin operations for TechMakers.
  - Key sections: Tenant list, system logs, feature flags, template management.
  - Contribution: Platform operations, tenant provisioning, and troubleshooting.

- Legal & Utility Pages (Privacy, Terms, Cookie, 404, 500, Loading/Success)
  - Purpose: Compliance, error handling, and UX polish.
  - Contribution: Trust, legal coverage, and user guidance.

- Create / Add Module Page
  - Purpose: Builder UI for creating mini-apps.
  - Key sections: Metadata, data model binding, permissions, preview, publish.
  - Contribution: Internal extensibility and tenant customizations.

- Edit / Manage Module Page
  - Purpose: Manage existing modules and versions.
  - Key sections: Version diff, configuration, assign/uninstall controls.
  - Contribution: Maintainability and controlled deployment.

### 2. Features
List core features with technical details and implementation notes.

- User Authentication
  - Support: Email/password, OAuth (Google/Microsoft), SAML/OIDC SSO.
  - Tech notes: JWT access + refresh tokens; password hashing (bcrypt/argon2); rate limiting; tenant-aware sign-in; secure session invalidation.
  - Contribution: Secure, enterprise-ready access.

- User Profile Management
  - Support: Profile CRUD, avatar upload/resizing, 2FA, SSO linking, scoped API keys.
  - Tech notes: Image processing service, token scopes & expiry, revocation endpoints.
  - Contribution: Builder access and personal security.

- Multi-tenant Company Module
  - Support: Tenant lifecycle, per-tenant config, row-level isolation.
  - Tech notes: tenant_id in core tables; per-tenant config store; provisioning workflows; optional DB schema partitioning; encryption of credentials.
  - Contribution: Scalable multi-tenancy and isolation.

- Workflow & Automation Engine
  - Support: Triggers, conditions, actions, schedules, manual runs, human approvals, retries.
  - Tech notes: Event ingestion pipeline, durable queue, connector adapters, idempotency, transactional semantics where feasible, logs/metrics, backoff strategies.
  - Contribution: Cross-system automation and resilience.

- AI Assistant & Agent Layer
  - Support: RAG with vector store, prompt templates, streaming responses, action gating, conversation audit.
  - Tech notes: Vector DB (e.g., Pinecone/Weaviate), embedding pipeline, prompt templating service with role-aware variables, token accounting, action gating checks against permission service, logs persisted.
  - Contribution: Contextual AI with safe action capabilities.

- Integrations & Connectors
  - Support: OAuth2/API-key connectors, per-tenant configs, sync scheduling, mapping engine.
  - Tech notes: Connector registry pattern, credential encryption, adapter interface, mapping UI persisted definitions, sync logs & health API, manual sync endpoints.
  - Contribution: Ingest external context and enable actions.

- Global Search
  - Support: Permission-aware search, autosuggest, snippet previews.
  - Tech notes: Elasticsearch/OpenSearch index with tenant scoping, real-time or near-real-time indexing, pre-filter by permissions, query latency targets (<200ms for common queries).
  - Contribution: Fast, secure retrieval.

- Unified Data & Context Layer
  - Support: Canonical entities, source metadata, linking, versioning.
  - Tech notes: Normalized models (Company, Department, User, Contact, Lead, Deal, Project, Task, Document, KPI), store external IDs, soft-deletes, materialized views for dashboards.
  - Contribution: Consistent single source for dashboards, AI, and workflows.

- Dashboard Framework
  - Support: Widget registry, drag-and-drop grid, role visibility, saved layouts.
  - Tech notes: Widget config persisted per tenant/user, grid system, caching adapters, export/schedule endpoints.
  - Contribution: Role-based visibility and configurable insights.

- Notifications & Alerts
  - Support: In-app websockets, email/push integration, alert rule engine.
  - Tech notes: Notification queue + durable store, rule engine evaluating KPIs/events, integrations to SendGrid/FCM, preferences per user.
  - Contribution: Timely awareness and automation triggers.

- Internal Module/Template Builder
  - Support: Module registration, data bindings, permissions, versioning.
  - Tech notes: Module metadata model, preview rendering using component library, deployment pipeline, marketplace registry.
  - Contribution: Reusability and fast tenant customization.

- Activity Log & Audit Trail
  - Support: Immutable logs for user actions, workflows, integrations, AI.
  - Tech notes: Append-only store, retention policies per tenant, export capabilities, redaction rules.
  - Contribution: Compliance and troubleshooting.

### 3. User Journeys
Step-by-step flows for major user types.

- Onboarding Admin (Tenant Owner)
  1. Visit Landing Page -> Click Sign Up -> Fill Sign Up/Invite Acceptance.
  2. Verify email -> Company Setup: name, timezone, currency, logo, create departments.
  3. Connect first integrations via Integration Connection Setup; run initial manual sync & mapping.
  4. Invite team members and assign roles.
  5. Open Global Dashboard and Executive Dashboard to verify KPIs.
  6. Install starter modules from Modules Hub; optionally create a workflow template.
  7. Configure alert rules and schedule first report.

- Executive
  1. Login -> Open Executive Dashboard.
  2. Review top-line KPIs and AI executive brief.
  3. Drill into cross-department heatmap; open department workspace drilldown for deeper context.
  4. Use AI Workspace "Ask" to request a one-page weekly brief -> review sources and schedule report export.
  5. Approve or request actions pushed to managers (via workflow/notification).

- Manager
  1. Login -> Go to Department Workspace.
  2. View top priorities and task list; open Workflows to create trigger for overdue tasks.
  3. Use AI Workspace "Analyze" for bottleneck detection in projects.
  4. Assign tasks from AI suggestions and notify assignees.
  5. Schedule recurring reports to execs.

- Team Member
  1. Login -> Open Global Dashboard or Department Workspace.
  2. View assigned tasks and workflows; update task status and add comments.
  3. Use AI Assistant to draft status updates or follow-ups.
  4. Receive notifications/alerts and respond (e.g., approve an item).

- Internal TechMakers Admin
  1. Login -> Open Admin Console.
  2. Provision tenant or impersonate for debugging.
  3. Monitor integration health and system logs; toggle feature flags.
  4. Deploy/update module templates to tenants and verify telemetry.

- AI-driven Action Flow (Role-aware)
  1. User requests an action in AI Workspace (e.g., "Advance deal to proposal stage").
  2. System resolves tenant, user roles/permissions, and relevant entities.
  3. Retrieval pipeline fetches supporting documents/data; prompt template assembled.
  4. AI suggests action with citations; UI displays required approvals.
  5. User confirms; permission checks executed and workflow action invoked.
  6. Action logged and notifications sent; audit entry created.

## UI Guide
(See Visual Style below for complete design tokens and component guidance. All UI must adhere to these values.)

---

## Visual Style

### Color Palette:
- Background primary: #05060A
- Background gradient/center glow: radial #071228 → #0B1A2A
- Surface/card background: #0F1720
- Inner card fill: #0C1116
- Primary accent: #9AD0FF
- Secondary accent: #154E78
- Action/success: #00D27A
- Neutral text: #8FA0B0
- Strong text: #F7FAFF
- Subtle border/grid lines: rgba(255,255,255,0.03) or #11202B at 3–6%
- Button fill (primary CTA): #FFFFFF
- Button text for white CTA: #081017

### Typography & Layout:
- Headings/display: Poppins or Manrope (700–900).
- UI/body: Inter or Roboto (400–600).
- Hero H1: 56–96px heavy (800–900) with one-two word accent in #9AD0FF.
- Paragraphs: 16–20px, line-height ~1.6.
- Micro labels: 10–12px small caps.
- 12-column responsive grid; generous left gutters (64–160px).
- Spacing modular scale: 8px base (8 / 16 / 24 / 32 / 48 / 64).
- Alignment: left-aligned text blocks, right stacked card balance.

### Key Design Elements
- Card Design: rounded radius 12–16px, inner shadow, faint outer stroke (#154E78 at 6–8%).
- Navigation: top-centered minimal links, white pill CTA top-right.
- Data Viz: thin lines, pale sky blue #9AD0FF for primary; #00D27A for positive.
- Buttons: Primary CTA pill white, dark text; secondary ghost dark with azure outline.
- Inputs: dark fills #0C1116, soft border #11202B low opacity, focus ring #9AD0FF at 12–18% opacity.
- Micro-interactions: transitions 120–200ms, hover translateY(-4px) for cards, subtle glow on focus.
- Live indicators: neon green #00D27A dot with minimal pulse.

### Design Philosophy
- Modern, high-contrast, enterprise-tech aesthetic.
- Minimalist, data-first clarity with modular, scalable components.
- Calm, technical refinement with subtle vignette and grid texture.
- Trustworthy and action-oriented accents and accessible typography.

Implementation notes: Apply the design system consistently; ensure contrast/accessibility, responsive layouts, and reusable component patterns.

## Instructions to AI Development Tool
1. Refer to Project Concept, Problem Statement, and Solution to understand the "why" for each requirement.
2. Ensure all pages and features align with solving the identified problems and meet role/tenant scoping rules.
3. Verify features/pages adhere exactly to the UI Guide visual style, tokens, spacing, and interactions before marking complete.
4. Maintain strict tenant isolation in data access, AI retrieval, and action execution.
5. Implement comprehensive logging and auditing for AI outputs, workflow runs, integration syncs, and admin actions.
6. Use the provided data structures, API integrations, and asset list as canonical references when scaffolding models, endpoints, and UI components.
7. Enforce security best practices: encrypted credentials, secure token flows, rate limiting, CSRF/XSS protections, and permission checks for sensitive actions.

PROJECT CONTEXT:
Connected AI Business OS — reusable multi-tenant platform for orchestrating integrations, normalizing company context, providing dashboards, department workspaces, workflow automation, and a role-aware AI assistant. Key system areas include authentication/onboarding, tenant lifecycle, role-permissions, integration connectors, unified data models, dashboard widget framework, workflow engine, AI RAG layer, internal module registry, reporting, notifications, activity/audit logs, and global search.

Data model summary (canonical fields):
- User: id, email, displayName, roles, authMethods
- Company (Tenant): id, name, timezone, currency, settings
- Department: id, companyId, name, leadUserId, settings
- Role & Permission: id, companyId, name, permissions
- Integration: id, companyId, provider, status, config
- UnifiedEntity: id, companyId, entityType, payload, sourceReferences
- Workflow: id, companyId, definition, status
- WorkflowRun: id, workflowId, status, logs
- Document: id, companyId, sourceProvider, externalId, text, metadata
- KPI / Metric: id, companyId, definition, cachedValue
- ActivityLog: id, companyId, eventType, actorUserId, payload, createdAt
- AIConversation: id, companyId, userId, messages, actions

APIs & Integrations:
- OpenAI / LLM provider for generative AI.
- HubSpot, Salesforce, QuickBooks, Google Drive/Calendar, Slack, Airtable, SendGrid, Firebase/FCM for push.
- Support connector registry pattern and encrypted per-tenant credentials.

Assets:
- App logo package, UI icon set (SVG), Figma design system kit, onboarding illustrations, AI prompt templates library, module starter pack, transactional email templates.

Success metrics & goals:
- Time-to-first-value: connect 3 integrations within 7 days.
- Adoption: 60% weekly active users among licensed seats.
- Retention: >80% monthly tenant retention for production clients.
- Automation impact: measurable reduction in manual cross-tool tasks within 90 days.

Security & Safety:
- Tenant isolation at every layer.
- AI safety: RAG + source citation, permission enforcement, confirmation for sensitive actions, AI action logging.
- Encryption in transit & at rest, secure token flows, auditability and redaction rules.

Deployment & Scalability notes:
- Horizontal partitioning for tenants, per-tenant rate limiting, observability (metrics/tracing), and feature-flag driven rollouts.
- Consider schema partitioning vs row-level tenancy depending on scale and compliance.

End of blueprint.

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
