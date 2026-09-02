# Officer Feedback and Form Intake

**Status:** Accepted product contract for implementation; not yet a claim of
deployment or publication

## Purpose

Guided Operations needs a practical asynchronous way for an active officer or
administrator to improve the product without needing the owner online. The
workflow records the exact page area being discussed, permits a bounded written
description, and gives the submitter an in-app status and follow-up path.

The same workspace accepts a blank candidate form for review. A candidate is
never an approved library item merely because it was uploaded. It remains a
private, quarantined review request until an authorized administrator records
the source, version, suitability, and publication decision.

## Scope and non-goals

This contract covers two private workflows for both interactive roles:

1. **Suggest a change** — report an issue, confusing wording, missing
   information, or improvement idea about a page or a selected page element.
2. **Request or upload a form** — request an existing form, submit a blank
   candidate source, or ask for an approved source to become browser-fillable.

It does not permit an officer or administrator to deploy code, alter database
schema, change Storage policy, publish a form automatically, replace an official
physical form, process a form through AI, or upload completed paperwork. A later
browser-fillable form remains a separate template-specific approval and
visual-fidelity workflow.

## Roles and visibility

| Capability                             | Officer | Administrator                                                                                |
| -------------------------------------- | ------- | -------------------------------------------------------------------------------------------- |
| Submit a page suggestion               | Yes     | Yes                                                                                          |
| Select exact page item                 | Yes     | Yes                                                                                          |
| Submit a blank form candidate          | Yes     | Yes                                                                                          |
| Read own requests and messages         | Yes     | Yes                                                                                          |
| Read requests from other accounts      | No      | Same-facility only                                                                           |
| Request a follow-up or change status   | No      | Same-facility only                                                                           |
| Mark a candidate ready for publication | No      | Same-facility only, review is attributable                                                   |
| Publish a form to the library          | No      | Not through this feature; use the existing protected template registration and approval path |

The existing authenticated session and authoritative account record decide each
operation. Page visibility, a supplied account ID, route, role, facility, or
Storage path never decides access.

## Suggest a change

The shared authenticated workspace exposes a **Suggest a change** control. It
offers three plain-language choices: **Point to this page**, **Report something
not working**, and **Request or upload a form**.

For a page suggestion, selection mode temporarily highlights the nearest
declared feedback target. The client records only a bounded target reference:
the current internal route, stable target identifier when declared, semantic
role/tag, accessible label or short visible label, and viewport dimensions. The
user may instead select the whole page. The server records the deployed commit
identifier only when supplied by trusted server configuration; it does not trust
a browser-provided release value.

The browser must not capture a full screenshot, page text, report narrative,
personnel details, policy text, session data, browser history, console output,
or DOM HTML. The visible confirmation summarizes the selected route and target
in plain language. This is intentionally safer and more durable than a raw
screen capture; a stable target ID remains useful after a layout changes.

Each request has a category, a required bounded description, an opaque client
request nonce for retry safety, a current status, append-only messages, and
append-only status history. Submitters can view their own content and status.
Administrators can filter a same-facility review inbox and send follow-up
messages. Email is not a content-delivery channel for this workflow; any future
notification contains only a safe count or link to the authenticated inbox.

## Form candidate intake

The Forms Library includes **Request or upload a form**. The submitter chooses
one purpose: add a missing form, replace an outdated source, request a
browser-fillable form, or report a problem with an existing form. They provide
the form title, source authority, revision reference when known, a bounded
reason, and one blank source file.

The browser accepts only PDF, DOCX, XLSX, PNG, or JPEG candidates within the
configured limit. A filename extension, content type, declared file size, and
client checksum are hints only. The finalize path verifies the exact Storage
object path, byte size, media type, and SHA-256 before a candidate becomes
reviewable. The upload is create-only under a request-bound private quarantine
prefix. Failed, abandoned, rejected, and expired candidates have a short
reviewed lifecycle; no broad delete operation is part of the workflow.

The form source is not displayed through email, public URLs, or ordinary browser
Storage access. It is not parsed, transformed, OCR'd, indexed, or sent to an AI
provider by this feature. Only a separately authorized template
review/registration workflow may promote an eligible source. A candidate may be
reviewed, need more information, be declined, or be marked ready for the
protected publication path; none of those states publishes it.

An active same-facility administrator may download a verified candidate from the
request detail through an authenticated no-store response. The route rechecks
the current administrator role, facility, private-object metadata, byte length,
and SHA-256 before returning an attachment; it never returns a public or signed
Storage URL.

## Statuses and messages

Every request uses one current status:

`submitted` → `under_review` → `needs_information` | `planned` |
`ready_for_publication` | `completed` | `declined` | `withdrawn`.

`ready_for_publication` applies only to a form candidate and means its owner
must use the existing protected form-template process. `completed` means the
reviewer resolved the feedback or finished the requested review; it does not
imply deployment. Status changes and messages preserve actor, timestamp, safe
reason code, and prior/new status without copying the request description into
the general audit log.

## Security and reliability requirements

- Every mutation requires current session authorization, same-origin and
  session-bound CSRF proof, closed input validation, private no-store responses,
  and a replay-safe request nonce.
- Product tables stay in `app_private`; browser clients receive only minimal
  DTOs through reviewed RPCs and same-origin Route Handlers.
- Tables are force-RLS, direct Data API table access is revoked, and every
  read/write transition has positive and negative role, status, facility, and
  cross-owner tests.
- Content-bearing request descriptions and file bytes are not copied to
  telemetry. Audit and operational events use allowlisted action/outcome/opaque
  identifiers only.
- Quarantine Storage is private, size/type bounded, request-bound, and covered
  by object access and abandoned-intent tests. It does not use public URLs.
- Status transitions are constrained in the database. Messages and status
  history are append-only; a retry returns the prior request rather than
  creating a duplicate.
- Non-production, test, screenshots, previews, and documentation use only
  fictional content and files.

## Acceptance evidence

Implementation requires product/server/component tests for element selection,
request validation, request retries, own-versus-other visibility, administrator
review, status history, message attribution, unauthenticated/disabled/cross-
facility denial, CSRF/origin rejection, upload-intent/finalization mismatch,
private Storage denial, and no content-bearing telemetry. It also requires
desktop and mobile browser evidence for selection mode, keyboard escape/focus
return, form upload progress/failure, review inbox, status follow-up, reduced
motion, and no console errors.

Promotion to production follows the repository release gates. This document does
not authorize a migration, deployment, or use of real data in non-production.
