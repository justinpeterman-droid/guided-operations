# Wave 8 automated accessibility evidence (2026-09-04)

- **Commit:** `bd4ee6b` (Wave 7 landed; this record accompanies Wave 8 closeout
  for automated checks only)
- **Environment:** Cloud agent production Next server (`npm run build` +
  `PLAYWRIGHT_USE_PRODUCTION_SERVER=true`), Chromium Playwright 1.62.1
- **Data:** Public and fictional preview routes only; no operational data
- **Scope:** Automated axe-core WCAG 2 A/AA + 2.1/2.2 AA tags via
  `tests/e2e/accessibility.spec.ts`

## Results

| Route                               | Result                                                                |
| ----------------------------------- | --------------------------------------------------------------------- |
| `/`                                 | Pass                                                                  |
| `/login`                            | Pass                                                                  |
| `/preview/workspace`                | Pass                                                                  |
| `/preview/report-assistant`         | Pass                                                                  |
| `/preview/policy-expert`            | Pass                                                                  |
| `/preview/forms-library`            | Pass                                                                  |
| `/preview/count-sheet`              | Pass                                                                  |
| `/preview/admin`                    | Pass                                                                  |
| `/preview/admin-retention`          | Pass                                                                  |
| `/preview/admin-paperwork-packages` | Pass                                                                  |
| Skip-link focus move                | Pass                                                                  |
| Preview keyboard focus indicator    | Pass                                                                  |
| Mobile + reduced motion previews    | Pass                                                                  |
| Zoom-equivalent reflow              | Pass                                                                  |
| `/account`                          | Blocked — missing local Supabase public env; page errors before shell |
| `/forms`                            | Blocked — missing local Supabase public env; page errors before shell |

## Explicitly not claimed

- Native screen-reader speech on the intended pilot OS/browser
- Operating-system print dialog inspection
- Protected Count Sheet / Document Studio AT scenarios from
  [hands-on accessibility and print validation](hands-on-accessibility-print-validation.md)

Those remain **Not exercised** until a human assistive-technology user runs the
runbook against a controlled fictional environment with Supabase configured. Do
not mark ROADMAP open item #8 or the checklist follow-on complete from this
record alone.
