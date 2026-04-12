# Integrations Capability Matrix (AI Agent)

This matrix defines the canonical provider-to-tool mapping for AI execution via `toolsExecute`.
It is the implementation contract for integration parity across Gmail, Google Drive, Google Calendar, HubSpot, QuickBooks, and Slack.

## Policy Columns

- `access`: `read` or `write`.
- `risk`: `low`, `medium`, `high`, `critical`.
- `roles`: allowed role groups for execution.
- `confirm`: whether UX should default to confirmation.
- `idempotency`: notes about replay safety.

## Gmail

| toolId | Provider Endpoint | access | risk | roles | confirm | idempotency |
|---|---|---|---|---|---|---|
| `gmail.search_messages` | `GET /gmail/v1/users/me/messages` | read | low | reader+ | no | safe read |
| `gmail.get_message` | `GET /gmail/v1/users/me/messages/{id}` | read | low | reader+ | no | safe read |
| `gmail.get_thread` | `GET /gmail/v1/users/me/threads/{id}` | read | low | reader+ | no | safe read |
| `gmail.list_labels` | `GET /gmail/v1/users/me/labels` | read | low | reader+ | no | safe read |
| `gmail.send_email` | `POST /gmail/v1/users/me/messages/send` | write | high | comms+ | yes | non-idempotent |
| `gmail.create_draft` | `POST /gmail/v1/users/me/drafts` | write | medium | comms+ | yes | non-idempotent |
| `gmail.modify_message_labels` | `POST /gmail/v1/users/me/messages/{id}/modify` | write | medium | comms+ | yes | idempotent-ish |

## Google Drive

| toolId | Provider Endpoint | access | risk | roles | confirm | idempotency |
|---|---|---|---|---|---|---|
| `google_drive.search_files` | `GET /drive/v3/files` | read | low | reader+ | no | safe read |
| `google_drive.fetch_file_metadata` | `GET /drive/v3/files/{id}` | read | low | reader+ | no | safe read |
| `google_drive.fetch_file_content` | `GET /drive/v3/files/{id}?alt=media` or `files.export` | read | low | reader+ | no | safe read |
| `google_drive.list_revisions` | `GET /drive/v3/files/{id}/revisions` | read | low | reader+ | no | safe read |
| `google_drive.create_folder` | `POST /drive/v3/files` | write | medium | ops+ | yes | non-idempotent |
| `google_drive.update_file_metadata` | `PATCH /drive/v3/files/{id}` | write | medium | ops+ | yes | idempotent-ish |
| `google_drive.create_permission` | `POST /drive/v3/files/{id}/permissions` | write | high | integration_admin+ | yes | non-idempotent |

## Google Calendar

| toolId | Provider Endpoint | access | risk | roles | confirm | idempotency |
|---|---|---|---|---|---|---|
| `google_calendar.list_events` | `GET /calendar/v3/calendars/{id}/events` | read | low | reader+ | no | safe read |
| `google_calendar.get_event` | `GET /calendar/v3/calendars/{id}/events/{eventId}` | read | low | reader+ | no | safe read |
| `google_calendar.list_calendars` | `GET /calendar/v3/users/me/calendarList` | read | low | reader+ | no | safe read |
| `google_calendar.create_event` | `POST /calendar/v3/calendars/{id}/events` | write | medium | comms+ | yes | non-idempotent |
| `google_calendar.update_event` | `PATCH /calendar/v3/calendars/{id}/events/{eventId}` | write | medium | comms+ | yes | idempotent-ish |
| `google_calendar.delete_event` | `DELETE /calendar/v3/calendars/{id}/events/{eventId}` | write | high | comms_admin+ | yes | idempotent-ish |

`create_event` supports optional `attendees` in the JSON body; the runtime sets query param `sendUpdates=all` when sending invitation emails to attendees, otherwise `sendUpdates=none`.

## Slack

| toolId | Provider Endpoint | access | risk | roles | confirm | idempotency |
|---|---|---|---|---|---|---|
| `slack.list_channels` | `GET /api/conversations.list` | read | low | reader+ | no | safe read |
| `slack.fetch_channel_messages` | `GET /api/conversations.history` | read | low | reader+ | no | safe read |
| `slack.fetch_thread_replies` | `GET /api/conversations.replies` | read | low | reader+ | no | safe read |
| `slack.list_users` | `GET /api/users.list` | read | low | reader+ | no | safe read |
| `slack.send_message` | `POST /api/chat.postMessage` | write | medium | comms+ | yes | non-idempotent |
| `slack.update_message` | `POST /api/chat.update` | write | medium | comms+ | yes | idempotent-ish |
| `slack.delete_message` | `POST /api/chat.delete` | write | high | comms_admin+ | yes | idempotent-ish |
| `slack.add_reaction` | `POST /api/reactions.add` | write | low | comms+ | no | idempotent-ish |

## HubSpot

| toolId | Provider Endpoint | access | risk | roles | confirm | idempotency |
|---|---|---|---|---|---|---|
| `hubspot.search_records` | `POST /crm/v3/objects/{type}/search` | read | low | reader+ | no | safe read |
| `hubspot.get_record` | `GET /crm/v3/objects/{type}/{id}` | read | low | reader+ | no | safe read |
| `hubspot.upsert_contact` | `contacts search + PATCH/POST` | write | medium | sales_ops+ | yes | idempotent by email |
| `hubspot.create_contact` | `POST /crm/v3/objects/contacts` | write | medium | sales_ops+ | yes | non-idempotent |
| `hubspot.create_note` | `POST /crm/v3/objects/notes` | write | medium | sales_ops+ | yes | non-idempotent |
| `hubspot.update_deal_stage` | `PATCH /crm/v3/objects/deals/{id}` | write | high | sales_admin+ | yes | idempotent-ish |
| `hubspot.create_deal` | `POST /crm/v3/objects/deals` | write | medium | sales_ops+ | yes | non-idempotent |

## QuickBooks

| toolId | Provider Endpoint | access | risk | roles | confirm | idempotency |
|---|---|---|---|---|---|---|
| `quickbooks.list_customers` | `GET /v3/company/{realmId}/query` | read | low | finance_read+ | no | safe read |
| `quickbooks.list_invoices` | `GET /v3/company/{realmId}/query` | read | low | finance_read+ | no | safe read |
| `quickbooks.get_invoice` | `GET /v3/company/{realmId}/invoice/{id}` | read | low | finance_read+ | no | safe read |
| `quickbooks.create_customer` | `POST /v3/company/{realmId}/customer` | write | medium | finance_ops+ | yes | non-idempotent |
| `quickbooks.create_invoice` | `POST /v3/company/{realmId}/invoice` | write | high | finance_ops+ | yes | non-idempotent |
| `quickbooks.send_invoice_reminder` | `POST /v3/company/{realmId}/invoice/{id}/send` | write | medium | finance_ops+ | yes | non-idempotent |
| `quickbooks.update_invoice_safe_fields` | `GET invoice + sparse update` | write | high | finance_admin+ | yes | idempotent-ish |

## ClickUp

| toolId | Provider Endpoint | access | risk | roles | confirm | idempotency |
|---|---|---|---|---|---|---|
| `clickup.list_workspaces` | `GET /v2/team` | read | low | reader+ | no | safe read |
| `clickup.list_tasks` | `GET /v2/list/{listId}/task` | read | low | reader+ | no | safe read |
| `clickup.create_task` | `POST /v2/list/{listId}/task` | write | medium | ops+ | yes | non-idempotent |

## Role Groups (normalized)

- `reader+`: `admin`, `owner`, `manager`, `company_admin`, `executive`, `analyst`, `auditor`, `compliance_auditor`.
- `comms+`: `admin`, `owner`, `manager`, `company_admin`, `executive`, `comms_ops`.
- `comms_admin+`: `admin`, `owner`, `company_admin`, `executive`, `comms_admin`.
- `sales_ops+`: `admin`, `owner`, `manager`, `company_admin`, `executive`, `sales_ops`.
- `sales_admin+`: `admin`, `owner`, `company_admin`, `executive`, `sales_admin`.
- `finance_read+`: `admin`, `owner`, `manager`, `company_admin`, `executive`, `finance_ops`, `finance_admin`, `auditor`.
- `finance_ops+`: `admin`, `owner`, `company_admin`, `executive`, `finance_ops`, `finance_admin`.
- `finance_admin+`: `admin`, `owner`, `company_admin`, `executive`, `finance_admin`.
- `ops+`: `admin`, `owner`, `manager`, `company_admin`, `executive`, `builder`, `integration_admin`.
- `integration_admin+`: `admin`, `owner`, `company_admin`, `executive`, `integration_admin`, `super_admin`.
