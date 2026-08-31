# Guided Operations Experience Design Brief

- **Status:** Owner-approved design direction
- **Approved:** 2026-08-27
- **Applies to:** Officer Home, Policy Expert, report workflows, shared product
  shell, and future administrator command-center work
- **Implementation reference:**
  `src/app/components/workspace-command-center.tsx` and the related rules in
  `src/app/globals.css`

## Handoff summary

Future contributors and assistant chats should preserve this direction:

> Guided Operations should feel calm, polished, formal, and high-end without
> feeling generic. Use a light cool blue-gray environment, strong editorial
> hierarchy, restrained depth, and practical command-center organization. The
> authenticated Home hero is a working command center, not a marketing banner.
> Report Assistant and Policy Expert are equal primary tools. Every operational
> value is real and authorized; fictional examples belong only in clearly
> labeled previews.

This brief defines experience and visual intent. It does not relax the product,
security, workflow, accessibility, or fictional-data requirements in
[`PRODUCT.md`](../../PRODUCT.md), [`principles.md`](principles.md), or
[`workflow-and-report-safety.md`](workflow-and-report-safety.md). Those
contracts take precedence when a visual idea conflicts with operational truth or
safety.

## Desired impression

The product should communicate:

- calm control rather than urgency;
- institutional credibility without looking like a generic government portal;
- premium craft without luxury decoration;
- practical confidence for an officer who needs to start work quickly;
- clear authorship, review, and source visibility; and
- visual sophistication that demonstrates strong website-design skill while
  remaining believable as an operational tool.

The product should not depend on a shield, badge, or agency-insignia treatment.
The current linked-path mark is an acceptable non-shield direction. A custom
floating mark may replace it after responsive, accessibility, reduced-motion,
and rights review. The mark supports the identity; it must not overpower the
work.

## Home is the command center

The authenticated Home page is the product's primary decision surface. Its first
viewport should answer three questions in order:

1. What do I need to do?
2. Where is my current work?
3. What other tools can I reach?

### Equal primary tools

Report Assistant and Policy Expert have equal visual and functional importance.
Neither may be reduced to a small utility link beneath the other.

- **Report Assistant:** starts or continues incident paperwork from known facts
  and keeps human review visible.
- **Policy Expert:** accepts an operational policy question and returns grounded
  guidance with approved source passages and bounded citations.

Each primary action needs a plain label, one-sentence functional promise,
recognizable icon, large click target, and honest unavailable state. Avoid
calling either tool “AI” in the primary label; describe the work it helps the
employee complete.

### Current work

The companion panel shows only server-authorized work belonging to the current
session. It may include an official incident number, descriptive incident name,
workflow state, and next action when those values are available from trusted
records.

- Never invent report rows, names, counts, notifications, health, timestamps, or
  synchronization claims.
- An empty state is a legitimate command-center state.
- Preview rows must say that they are fictional training examples.
- Administrative facility-wide metrics do not belong in the officer Home hero.

### Review path and supporting tools

The command center may reinforce the product's review model with a concise path
such as **Capture → Review → Confirm**. It is explanatory, not a fabricated
progress tracker.

Forms, Count Sheet, report history, and similar destinations sit below the two
primary tools as compact supporting actions. Administrator access is visible to
authorized administrators but remains a secondary, intentional entry rather than
competing with the officer's normal work.

## Page-family layout

One design system supports distinct working densities:

- **Officer Home:** calm, spacious, and action-first.
- **Report and Document Studio:** wider, visually quieter, document-oriented,
  and focused on facts, revisions, missing information, and deliberate output.
- **Policy Expert:** question and cited answer are the main two-part workspace;
  citations and source limitations remain visually inseparable from the answer.
- **Administrator areas:** denser command-center organization is appropriate,
  but every count and status needs a trustworthy query and honest loading,
  empty, error, and unavailable state.
- **Sign-in and account safety:** focused single-purpose pages with no
  decorative operational data and no credential values in URLs.

Page titles, route identity, and the primary action should remain visible
without requiring the user to interpret a decorative dashboard.

### Document Studio work hierarchy

Document Studio is an incident-level working surface, not a general dashboard.
Its top-level navigation has four task-oriented sections in this order:

1. **Reports** — the default section for supported draft, review, finalize, and
   report-history work.
2. **Notes & Facts** — reviewed fact states from the current authorized
   incident revision.
3. **Paperwork** — required items grouped by available digital work,
   physical-form requirement, and unavailable digital support.
4. **Incident Record** — current incident details, the active incident
   revision, and linked report revision heads.

Copy to Records remains a subordinate Reports subsection while it is
unavailable. It must not receive equal top-level prominence or fake print, Word,
or submission actions. Overview and report-history context belong together in
Incident Record rather than competing with active report and fact work.

The incident header may present one advisory **Next action** derived only from
server-authorized incident, reporting-officer, reviewed-fact, and report values.
That guidance is navigation, not persisted workflow state. It must never infer
packet completeness, filing, submission, synchronization, or system-of-record
status.

Desktop keeps an accessible four-item tab list. Mobile uses a labeled native
section selector rather than a horizontally scrolling tab rail. Both controls
must share one active-section state and preserve the same information priority.

## Visual language

### Color

Use the implemented cool blue-gray family as the baseline:

- pale blue-gray canvas and raised white/off-white work surfaces;
- deep navy for structure, primary actions, and high-confidence typography;
- muted slate blue for supporting copy and dividers;
- clear blue for links and keyboard focus; and
- restrained warm gold for small highlights, review state, or orientation.

Gold is an accent, not the atmosphere. Avoid large gold fields, saturated
royal-blue gradients, black dashboard themes, neon glow, or emergency-red
decoration. Error and warning colors remain available for real states and must
not be used as ornament.

### Typography

Use an editorial serif selectively for brand moments, major page titles, and
important card titles. Use the system sans-serif for forms, navigation, status,
instructions, tables, and long operational reading. The result should feel
formal and crafted while remaining fast to scan on ordinary facility hardware.

### Shape, depth, and imagery

- Prefer a few large composed surfaces over many interchangeable small cards.
- Use medium corner radii, fine blue-gray borders, and soft directional shadow.
- Tactile buttons may lift slightly on hover and settle on press.
- Keep icon drawing coherent, restrained, and legible without color.
- Decorative line work or soft background atmosphere may frame Home but must
  never obscure text or imply operational data.
- Do not use inmates, weapons, threatening weather, surveillance drama, or
  generic stock imagery to manufacture seriousness.

## Responsive behavior

Desktop and mobile express the same priority, not two different products.

### Desktop

- Use a bounded wide canvas with the command introduction and current work in a
  balanced two-column composition.
- Keep Report Assistant and Policy Expert side by side and equal.
- Place supporting tools in a compact band below the main command surface.

### Mobile

- Collapse the command surface into one readable column.
- Stack the two primary tools consecutively with equal weight; do not hide
  Policy Expert in a menu.
- Put current work after the primary choices.
- Convert supporting tools to full-width touch rows.
- Preserve at least 44 CSS-pixel touch targets and useful spacing at 320 CSS
  pixels, 200% text size, and 400% zoom.
- Avoid horizontal scrolling, clipped focus rings, or status labels that detach
  from the record they describe.

## Motion and interaction

Motion communicates response, not spectacle.

- Hover lift and arrow travel should be brief and subtle.
- Pressed state should feel tactile and immediate.
- Focus must be stronger and more reliable than hover.
- No looping glow, parallax, animated background drift, or delayed work state.
- `prefers-reduced-motion` removes decorative travel without removing state
  feedback.
- Loading must name what is loading; unavailable states must provide a practical
  next step.

## Voice and wording

Use plain, composed, operational language. Good copy explains what the employee
can do and what remains under their control.

- Prefer “Start a report,” “Ask Policy Expert,” “Your work,” and “Review before
  anything becomes official.”
- Avoid vague technology copy such as “Unlock AI-powered insights,” “smart
  workspace,” or “next-generation corrections platform.”
- Do not overuse “command center” in visible UI. It is the organizing concept,
  not a slogan.
- Policy wording must distinguish cited policy, paraphrase, operational advice,
  and insufficient evidence.
- Report wording must reinforce that the employee confirms facts and reviews
  every output.

## Acceptance checklist

A design change is aligned only when all applicable statements are true:

- Report Assistant and Policy Expert remain equal primary Home actions.
- The first viewport helps the employee choose a real task quickly.
- The interface feels cool blue-gray, formal, calm, and crafted.
- The composition is distinctive without relying on an oversized shield or
  decorative dashboard metrics.
- Every operational value is authorized and truthful.
- Empty, loading, unavailable, unsaved, failed, and conflict states are clear.
- Desktop and mobile preserve the same information priority.
- Keyboard, focus, touch, zoom, contrast, and reduced-motion behavior pass.
- Policy answers keep citations and limitations attached.
- Report work keeps review, missing information, and deliberate official actions
  visible.

The current command-center implementation is a candidate expression of this
brief, not permanent visual acceptance. Future refinement should be evaluated
against this brief in real desktop and mobile browsers before replacing the
authenticated experience.
