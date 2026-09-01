---
version: alpha
name: "Guided Operations"
description:
  "A calm, policy-grounded operational workspace with an editorial
  command-center hierarchy and restrained institutional detail."
colors:
  primary: "#123d66"
  canvas: "#eef3f7"
  surface: "#ffffff"
  surface-raised: "#f9fbfd"
  navy-950: "#071f38"
  navy-900: "#0b2d50"
  navy-800: "#123d66"
  navy-700: "#185687"
  action: "#176aa6"
  gold-100: "#f5e5b5"
  gold-300: "#e7bd5a"
  gold-400: "#d7a640"
  gold-500: "#c58b22"
  ink: "#10243d"
  ink-secondary: "#3d5266"
  muted: "#516579"
  border: "#cbd7e1"
  line: "#c2d0da"
  focus: "#075fae"
typography:
  sans:
    fontFamily: '"Segoe UI", Aptos, system-ui, -apple-system, sans-serif'
  brand:
    fontFamily: 'Georgia, "Times New Roman", serif'
  mono:
    fontFamily: '"Cascadia Mono", "SFMono-Regular", Consolas, monospace'
rounded:
  control: "10px"
  card: "16px"
  feature: "24px"
omitted:
  - section: spacing
    reason:
      "The established app currently owns responsive spacing in component CSS;
      shared spacing aliases will be added only when they can replace existing
      values without a second token system."
components:
  button:
    backgroundColor: "#123d66"
    textColor: "#ffffff"
    rounded: "10px"
    height: "44px"
  input:
    backgroundColor: "#ffffff"
    textColor: "#10243d"
    rounded: "10px"
    height: "44px"
  card:
    backgroundColor: "#ffffff"
    textColor: "#10243d"
    rounded: "16px"
  featureCard:
    backgroundColor: "#ffffff"
    textColor: "#10243d"
    rounded: "24px"
---

# Guided Operations Design System

## Overview

### Creative North Star

Guided Operations should feel like a well-prepared institutional briefing desk:
ordered documents, clear status marks, dependable tools, and enough editorial
hierarchy to help an employee orient quickly. It is formal without looking
ceremonial and polished without resembling a luxury marketing site.

### Product context and register

- **Audience and primary job:** correctional officers complete reports, consult
  authorized policy, and manage approved forms; administrators oversee accounts,
  health, audit, retention, and routine paperwork.
- **Target market and evidence:** one configured United States correctional
  facility, as defined by `PRODUCT.md` and
  `docs/product/roles-and-permissions.md`.
- **Locale and language policy:** English (`en-US`) with plain operational
  wording. Technical, legal, or platform vocabulary must not replace language
  employees recognize.
- **Usage scene:** repeated desktop use with equal mobile responsibility,
  sometimes under time pressure and with dense operational information.
- **Register:** hybrid. The public landing page may carry the strongest
  editorial expression; authenticated officer and administrator routes
  prioritize task clarity, state truth, and familiarity.
- **Memorable signature:** a restrained Georgia display face paired with cool
  blue-gray surfaces, navy structure, and narrow gold accents that echo an
  organized facility briefing rather than generic SaaS cards.
- **Restraint:** work pages, forms, tables, alerts, and consequential actions
  remain quiet and practical. Glow, blur, animation, gradients, and decorative
  badges never compete with operational state.
- **Anti-references:** generic analytics dashboards, dark tactical interfaces,
  playful consumer apps, luxury-editorial layouts, and dense records systems
  that rely on tiny targets or color alone.
- **Token ownership/runtime mapping:** model B from the premium token contract.
  `src/app/globals.css` is the canonical runtime source. This file mirrors
  accepted `--gow-*` values and explains their use; it does not generate CSS.

The detailed owner-approved direction remains in
`docs/product/experience-design-brief.md`. Product, safety, permission, and
workflow contracts override aesthetic preference.

## Colors

`canvas`, `surface`, and `surface-raised` create the cool daylight workspace.
The navy scale carries brand, navigation, headings, and primary structure. Gold
is a narrow identity accent, not a generic warning or success color. `ink`,
`ink-secondary`, and `muted` establish readable text hierarchy. `focus` is
reserved for the visible focus ring and must remain distinct from nearby borders
and fills.

Semantic success, warning, information, error, and danger treatments must
include text or iconography in addition to color. New colors belong in the
`--gow-*` runtime token block before use in shared components.

## Typography

Georgia is the brand/display voice and is used selectively for the product name,
landing thesis, and primary page headings. Segoe UI/Aptos is the operational
voice for controls, forms, tables, navigation, status, and body text. Monospace
is limited to redacted identifiers, hashes, revisions, and other technical
values where character distinction matters.

Landing headlines may be expressive. Work-page titles must fit their task
context and should not push the first actionable control below the initial
viewport. Controls use sentence case and stable action vocabulary.

## Layout

The established layout uses centered page frames, a two-column desktop
command-center pattern, natural document scrolling, and single-column mobile
stacking. The current responsive breakpoints at 860px and 620px remain canonical
until a deliberately tested system change replaces them.

Important actions and inputs have a minimum 44px target. The interface must
operate at 320px CSS width and at 200% and 400% zoom. Document scrolling remains
available; tables may own internal horizontal overflow only when the UI names or
visibly cues that behavior.

Loading, help, error, and save-state regions reserve enough space to avoid
moving nearby controls. Sticky elements must not obscure focused controls,
validation, or zoomed content.

## Elevation & Depth

Hierarchy comes first from tonal surfaces, borders, spacing, and typography.
`--gow-shadow-card` is reserved for high-value feature or entry surfaces;
`--gow-shadow-soft` is for quiet raised panels. Dense operational rows and
routine form groups stay flatter. Blur and glow are not normal work-surface
treatments.

## Shapes

Controls use the 10px radius, standard cards use 16px, and major feature panels
use 24px. Pill shapes are reserved for compact status or metadata and never used
to make every control appear decorative. The shield-like brand mark is the only
intentionally emblematic silhouette.

## Components

### Foundational visual states

Every interactive component defines default, hover, focus-visible, active,
disabled, and busy states. Forms and async surfaces also define saved, warning,
error, reconnecting, conflict, and unavailable states where applicable. Disabled
actions remain legible and include a nearby reason when the cause is not
obvious.

### Buttons and actions

Buttons combine emphasis (solid, outline, quiet) with intent (primary, neutral,
information, warning, danger). Enabled pointer targets show pointer intent and
visible focus. Busy labels do not change button dimensions. Consequential danger
actions are visually separated from safe primary actions and receive their
highest emphasis only in the final confirmation.

### Navigation and data display

Officer and administrator shells share brand, focus, spacing, and action
language but keep their role boundaries visible. Tables remain semantic. Long
identifiers provide a readable preview and an accessible route to the full value
when authorization permits. Status chips supplement, not replace, plain status
text.

### Forms and overlays

Labels remain visible. The app owns validation text and recovery, preserves
entered values, associates errors with fields, and moves focus to the first
invalid field after submit. Secret fields are masked by default and provide a
keyboard-operable reveal control. App-owned dialogs are used for consequential
confirmation; browser alert, confirm, and prompt are not product UI.

### Iconography

Use the existing restrained line-icon language when an icon materially improves
recognition. Text remains mandatory for unfamiliar, consequential, or primary
actions. Emoji and decorative symbol stand-ins are not application icons.

### Motion

Motion explains state: focus, expansion, confirmation, or navigation continuity.
Normal feedback uses short, interruptible transitions. Reduced-motion
preferences remove nonessential movement. No ambient animation is added to
authenticated work surfaces.

### Content and data visualization

Copy uses plain verbs and names the employee-controlled result. Errors explain
what happened and the next safe action. Unknown remains a valid operational
state. The UI never implies that a draft is official, a client change is saved
before server confirmation, or a physical acknowledgment is filing.

## Do's and Don'ts

- **Do:** preserve equal prominence for Report Assistant and Policy Expert on
  the officer command center.
- **Do:** use hierarchy to reveal workflow state, provenance, missing
  information, and the next safe action.
- **Do:** refine the existing tokenized CSS and shared components incrementally.
- **Don't:** introduce a second framework, token system, or screen-local visual
  language.
- **Don't:** use oversized editorial headings where they delay the operational
  task.
- **Don't:** compress forms, tables, links, or status controls below accessible
  touch and zoom requirements.
