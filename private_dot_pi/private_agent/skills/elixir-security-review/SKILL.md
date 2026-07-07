---
name: elixir-security-review
description: Reviews Elixir, Phoenix, LiveView, Ecto, and API changes for authorization, tenant isolation, injection, XSS, secrets, uploads, redirects, and other security regressions.
---

# Elixir Security Review

Use this skill for Elixir/Phoenix changes that touch authentication, authorization, account or tenant data, controllers, LiveViews, channels, resolvers, queries, uploads, redirects, external input, secrets, logging, or raw HTML. It can also be requested explicitly as a security review.

## Review Contract

Find concrete security regressions that could expose data, grant unauthorized actions, execute attacker input, leak secrets, or weaken security controls. Do not report theoretical issues without a verified code path. Deletions matter: removing an auth check, sanitizer, signature check, or validation can be a finding even when no new code replaces it.

## Evidence Rules

1. Read the diff and the full relevant files, especially controllers, LiveViews, context modules, schemas, plugs, and templates.
2. Inspect sibling code before flagging missing checks; local authorization and sanitization patterns vary by project.
3. Trace user-controlled values from params/session/socket/uploads/webhooks through queries, mutations, rendering, redirects, logging, and jobs.
4. Verify compensating controls before reporting. If auth happens in a plug, `on_mount`, context helper, policy module, or downstream permission check, cite it and do not flag the local call.
5. Separate introduced regressions from pre-existing risks. Pre-existing high-risk issues may be observations, but blockers should be tied to the reviewed change unless the task asks for a full audit.

## Scope Triggers

| Change touches | Apply this lens |
| --- | --- |
| Auth plugs, policies, roles, permissions, scopes | AuthN/AuthZ |
| `account_id`, `tenant_id`, `org_id`, `user_id`, resource IDs | Tenant isolation / IDOR |
| Controllers, LiveViews, GraphQL resolvers, channels | Boundary authorization and input validation |
| `handle_params`, URL-driven modals/forms, routes | Direct-navigation disclosure |
| HEEx, `raw/1`, markdown/html, JS hooks | XSS/output encoding |
| Ecto fragments, raw SQL, dynamic ordering/filtering | Injection |
| Changesets and params casting | Mass assignment |
| Logs, errors, telemetry, config | Secrets and sensitive data |
| Uploads, file reads/writes, paths | Path traversal and file safety |
| Redirects, return paths, callback URLs | Open redirect |
| Tokens, HMAC, JWT, API keys | Signature verification and timing |

## Authorization and Tenant Isolation

Check every data-fetching or mutating path:

- Resource loads by ID must be scoped by the current actor, account, tenant, organization, or verified by a policy before data is exposed or mutated.
- Never trust `user_id`, `account_id`, `tenant_id`, role, or permission values from params as authorization facts.
- Bulk/list queries must include the same tenant/account scope used by nearby code, unless explicitly admin-only and guarded.
- Controller/resolver actions that load by ID need a scoped query or explicit ownership/permission check before returning the resource.
- LiveView `mount/3`, `handle_params/3`, and `handle_event/3` must all be considered. A submit event guard is not enough if URL navigation can render a pre-populated form first.
- PubSub subscriptions must not build private topics from user-controlled IDs unless the current user is authorized to subscribe.
- Admin-only paths need server-side role checks, not just hidden UI.

Approved pattern: an initial unscoped lookup can be safe if the same lifecycle path performs a verified downstream scope/permission check before displaying sensitive details or taking action. Flag the missing downstream check, not the bare lookup alone.

## LiveView and URL-Driven UI Risks

- New `live_action`, route, modal, slide-over, or tab with sensitive data should have `handle_params/3` or equivalent authorization, not only button visibility.
- Writes in `mount/3` should usually be guarded by `connected?(socket)`; otherwise a plain GET can trigger a mutation without LiveView event/CSRF semantics.
- Async loads should use the current viewer's scope, not only the resource owner's scope.
- Upload handlers must validate file size, type, destination, and ownership server-side.

## XSS and Output Encoding

- Phoenix/HEEx escaping is the default safe path. Treat `raw/1`, `Phoenix.HTML.raw/1`, and manually inserted HTML as security-sensitive.
- Rich HTML must be sanitized before rendering; accept the sanitizer used locally by the project.
- Markdown-to-HTML paths must go through the project's safe helper, not directly to `raw/1`.
- Avoid JS `innerHTML`, `insertAdjacentHTML`, `document.write`, or server-pushed HTML unless sanitized before insertion.
- JSON embedded in script contexts must be encoded, not interpolated.
- Email templates are also render surfaces; do not render user content raw without sanitization.

## Injection and Unsafe Input

- Ecto query DSL is generally safe; danger is raw SQL, `fragment`, dynamic identifiers, and user-supplied sort/filter/order values.
- `fragment` and `Ecto.Adapters.SQL.query` must use placeholders and parameter lists, not interpolation/concatenation.
- Dynamic fields/orders must be whitelisted and converted safely.
- Do not call `String.to_atom/1` on user/external input. `String.to_existing_atom/1` is acceptable only for bounded, preloaded values and should handle invalid input.
- Avoid unsafe deserialization such as `:erlang.binary_to_term/1` on attacker data without `[:safe]`.
- XML parsing of user data must disable external entity fetching or use a safe project wrapper.

## Mass Assignment and Sensitive Fields

- Changesets should not cast fields that control ownership or privilege: `role`, `is_admin`, `account_id`, `tenant_id`, `permissions`, `email_verified`, plan/entitlement fields, or audit fields.
- Server-controlled identifiers should be assigned from trusted scope/session/context, not params.
- `cast_assoc/3`, embedded schemas, JSON maps, and custom parameter merges can also introduce mass assignment.

## Secrets, Logging, Metadata, and Errors

- Do not log passwords, tokens, API keys, secrets, credentials, raw auth headers, webhook signatures, private URLs, or full sensitive structs.
- Sensitive structs should redact via `Inspect` or local redaction patterns.
- Distinguish human-readable log messages from persisted structured metadata. Inspected strings, safe-params-style strings, or other stringifying helpers may be fine for text logs, but reject them for JSON/map columns or metadata contracts that downstream code queries by field.
- Redaction should remove sensitive keys while preserving safe structure and queryable field names where structured metadata is the contract.
- Error responses and exception messages should not reveal secrets or whether a private resource exists.
- Hardcoded secrets in source, config, examples, comments, fixtures, or tests are findings.

## Tokens, Redirects, and Timing

- Client-controlled JWTs or signed payloads must be verified before claims are trusted. `peek`/decode-only APIs are unsafe across a trust boundary.
- HMAC/signature comparisons and bearer token comparisons should use constant-time comparison such as `Plug.Crypto.secure_compare/2`.
- Redirect targets, callback URLs, and `return_to` paths must be verified routes or validated relative paths; reject `//host` and absolute attacker URLs unless explicitly whitelisted.

## Output Guidance

Report only verified findings with a file path, line when available, concrete exploit/failure path, and minimal fix. Prefer severity language that matches the main review format:

- `[blocking]` for exploitable auth bypass, cross-tenant data exposure, secret leak, injection, unsafe upload/path access, or signature/redirect flaw that can ship to production.
- `[observation]` for pre-existing or defense-in-depth concerns not introduced by the change.

If no verified issue exists, say that the security lens found no blockers and mention the key controls you checked.
