# Product Principles

These principles are product requirements. Architecture and implementation may
refine how they are delivered, but may not silently relax them.

## 1. Operational truth outranks convenience

The product must represent what an authorized employee actually knows and
confirms. It must not guess a date, time, person, location, classification,
charge, evidence detail, medical outcome, notification, or required form.

- Empty and unknown are valid states.
- “Not yet known,” “Unknown,” and “Not applicable” must remain distinct where
  the workflow needs that distinction.
- A complete-looking document is not more important than an accurate document.
- Generated drafts must display their draft/review state until a person
  completes the required review.

## 2. AI proposes; people decide

AI may:

- identify candidate facts in employee-entered notes;
- suggest missing-information questions;
- draft narratives from confirmed structured facts;
- retrieve and summarize authorized policy passages;
- suggest relevant forms based on confirmed facts and approved rules.

AI may not:

- silently change a confirmed fact;
- invent a fact to satisfy a required field;
- select an official charge or finding without the defined human decision;
- file, submit, close, reopen, archive, print, download, or acknowledge
  paperwork automatically;
- answer a policy question without verifiable source support;
- use one employee's private or unauthorized records to assist another employee.

Every AI output must be treated as untrusted input until it passes schema
validation, authorization checks, provenance checks, and the relevant human
review.

## 3. The incident is the digital folder

One canonical incident identity connects:

- involved and reporting officers;
- field notes;
- proposed and confirmed facts;
- missing-information answers;
- generated and edited reports;
- required, suggested, additional, and physical-only paperwork;
- revision history;
- deliberate document actions; and
- administrative record state.

The product must not create competing “copies” of the same incident merely
because another employee prepared a report. Relationships are explicit:
reporting officer, preparing officer, editor, and administrator are different
concepts.

## 4. Workflow state is calculated, not decorated

Officer-facing progress comes from durable workflow facts, such as whether notes
exist, facts were confirmed, required questions were reviewed, and reports are
ready. Officers do not receive an arbitrary status dropdown.

Administrative record-management state—such as open, closed, reopened, or
archived—is separate, permission-controlled, and audited. UI labels must not
blur workflow progress with administrative disposition.

## 5. One clear next action

Officer screens are optimized for people who may use the system infrequently or
under time pressure.

- Put the primary next action where it can be identified quickly.
- Prefer plain operational language over product or AI jargon.
- Use progressive disclosure instead of presenting every field and tool at once.
- Preserve a user's visible work when a save fails.
- Explain recovery in the same place as the failed action.
- Keep dense metrics, bulk controls, and oversight tools in administrator views.

## 6. Visible trust

The interface must make important state apparent:

- unsaved, saving, saved, reconnecting, conflict, and failed are distinct;
- citation title, passage, and page location are visible for policy answers;
- source and revision are visible where an official form or policy depends on
  them;
- physical-only paperwork cannot be mistaken for a generated official
  substitute;
- missing information remains visible;
- “last synced,” service health, version, identity, and notification data appear
  only when backed by a trustworthy source.

Never use sample operational values as a production fallback.

## 7. Deliberate official actions

An authorized employee must intentionally initiate every consequential output or
state change. At minimum, explicit controls are required for:

- confirming facts;
- saving a revision;
- regenerating a draft;
- copying text to another system;
- printing or downloading a supported document;
- adding or removing optional paperwork;
- acknowledging completion of a physical form;
- resetting another user's credential;
- closing, reopening, transferring, or archiving a record; and
- changing an employee's role or account state.

Confirmation language must name the action and its impact. Destructive or
security-sensitive actions require stronger confirmation or step-up
authentication.

## 8. Privacy by design

Development and validation use fictional operational data only. Production may
hold owner-authorized real data after release gates, but the product must still
minimize collection and apply the two-year retention and legal-hold rules.

- Do not place narrative text, policy questions, answer excerpts, PINs, tokens,
  session secrets, or generated document bodies in ordinary audit logs.
- Do not place protected data in URLs, analytics, error trackers, preview
  deployment metadata, screenshots, test traces, or source control.
- Store policy files and generated artifacts in private object storage with
  short-lived, authorized access.
- Separate staff profiles from authentication accounts.
- Deny access by default, enforce it on the server and in Postgres, and test
  negative cases.

## 9. Accessible by default

Accessibility is not a final polish pass.

- All actions must work by keyboard.
- Interactive targets must be large enough for touch and Windows display
  scaling.
- Focus must be visible and must not be clipped.
- Labels, errors, statuses, dialogs, and tables require programmatic semantics.
- Meaning must not depend on color, shadow, motion, or icon alone.
- Motion must never delay work; `prefers-reduced-motion` removes travel and
  decorative animation.
- Layouts must reflow at mobile sizes and at 200% and 400% text zoom.
- Print output requires separate acceptance from screen output.
- Automated checks support, but do not replace, manual screen-reader and
  physical-device review.

## 10. Calm, practical visual language

Preserve the accepted light navy-and-gold direction: premium but approachable,
restrained physical depth, high legibility, and clear hierarchy.

- Home may use a calm, fictional scenic composition; operational editors remain
  wider and visually quieter.
- Avoid inmates, weapons, emergency imagery, threatening weather, dramatic
  surveillance imagery, looping glows, parallax, and decorative motion during
  work.
- Use one coherent icon and control system with accessible labels.
- Avoid analytics-dashboard treatment on the officer Home page.
- Use honest empty states rather than decorative sample incidents, counts,
  health claims, names, avatars, or notifications.
- Generated or third-party assets require recorded source, rights, metadata, and
  privacy review.

## 11. Provider-neutral domain design

Product language and domain objects may not expose a provider-specific API as
the permanent contract.

- AI generation accepts a versioned request and returns validated domain output
  plus provenance and provider metadata.
- Retrieval returns policy IDs, chunk IDs, page mappings, scores, and verifiable
  excerpts.
- Storage code works with opaque object references, not public provider URLs.
- Authentication presents the approved employee-number/PIN-like experience
  regardless of the underlying session adapter.
- Provider credentials are server-only.

Provider swaps must not change workflow safety rules or erase provenance.

## 12. Evidence before status claims

Code review, continuous integration, deployment, migration, pilot approval, and
platform retirement are separate gates.

- A merged pull request is not a deployment.
- A successful deployment is not a production approval.
- A successful corpus import is not citation acceptance.
- A new site receiving traffic is not permission to destroy the old platform.
- A rollback plan is not proven until it is exercised against a representative
  environment.

Every acceptance claim should identify the exact commit, environment, test or
manual evidence, date, and responsible reviewer.
