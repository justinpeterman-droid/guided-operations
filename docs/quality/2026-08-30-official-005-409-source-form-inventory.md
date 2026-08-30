# Official 005/409 authoritative source form: inventory

- **Date:** 2026-08-30
- **Status:** authoritative source received; field map and rendered fidelity
  still unapproved, so the fidelity gate stays closed
- **Supersedes the "next evidence needed" section of**
  `2026-08-30-official-005-409-source-review.md`

The earlier review refused `005 templet.docx` as authoritative and asked for the
real form. The owner supplied it. This records its identity and every field on
it, which the review requires before any rendering code is written.

## Source identity

| Property                 | Value                                                                  |
| ------------------------ | ---------------------------------------------------------------------- |
| Source kind              | `authoritative_form`                                                   |
| SHA-256 of source bytes  | `e893a7930be9d7fa8e058aa695a25fd0b94b6e94f50301c11d7ccf91fc78d963`     |
| Superseded copy          | `f1e5f084b9bf1b08e41722f0e9bbdbb1d33c877b23ecbe5f994fd3a9f0c477bb`     |
| Format                   | DOCX, 4 tables, 11 paragraphs, no images                               |
| Regulation               | Administrative Regulation, State of Arkansas, Department of Correction |
| Section number           | 005/409                                                                |
| Page number              | 005-3 of, 409-9 of 9                                                   |
| Subject                  | Reporting of Incidents-005; Use of Force 409                           |
| Board approval date      | 9/27/87                                                                |
| Supersedes               | 005/409 Form dated 12/19/85                                            |
| Attorney General review  | 6/11/87                                                                |
| Filed secretary of state | 10/02/87                                                               |
| Form footer              | `INCRT db (Revised )`                                                  |

The superseded hash is the same form before the owner cleared the answered
cells. Both are recorded so the earlier reading of this document remains
traceable to the bytes it described.

**The revision field is empty.** The footer's "Revised" parenthesis contains no
date, so the document carries no revision identifier of its own. The regulation
dates above are the only version evidence available, and they describe the
regulation rather than this rendering of the form. The
`approved_source_revision` gate input should record the regulation dates
explicitly and note the absence, rather than inventing a revision number.

## Blank-form status

The first copy reviewed was a working copy carrying one officer's default
answers. The owner cleared them and resaved. Verified against the current bytes,
every one of those cells is now empty:

| Field                            | Was                | Now   |
| -------------------------------- | ------------------ | ----- |
| RANK                             | `Sgt.`             | empty |
| TIME                             | `Approximately pm` | empty |
| INMATE(s) PRESENT                | `Same as Involved` | empty |
| EMPLOYEE(s) PRESENT              | `Same as Involved` | empty |
| OTHERS PRESENT/INVOLVED          | `N/A`              | empty |
| EXTENT OF INJURIES TO OFFICER(s) | `None`             | empty |
| TREATMENT AFFORDED TO OFFICER(s) | `None`             | empty |

One value remains: **UNIT/DIVISION still reads `Benny Magness Unit`.** That is a
judgement call rather than leftover data - a unit-specific blank may
legitimately carry its own unit name. It needs an explicit decision before the
field map is approved, because a renderer either prints it as part of the form
or fills it as a field, and the two are not the same thing.

## Field inventory

### Header block (table 1)

Regulation identity, section number, page number, the 005 and 409 designation
boxes with their labels `Incident Report` and `Use of Force`, subject line, and
`UNIT/DIVISION`.

### Body block (table 2)

| Field                             | Sub-labels            |
| --------------------------------- | --------------------- |
| REPORTING EMPLOYEE                | Last, First, Middle   |
| RANK                              | -                     |
| SHIFT ASSIGNMENT                  | -                     |
| DATE                              | -                     |
| TIME                              | -                     |
| LOCATION                          | -                     |
| INMATE(s) INVOLVED                | -                     |
| EMPLOYEE(s) INVOLVED              | Names, Titles, Rank   |
| INMATE(s) PRESENT                 | Names and ADC Numbers |
| EMPLOYEE(s) PRESENT               | Names, Titles, Rank   |
| OTHERS PRESENT/INVOLVED (Specify) | Names and Addresses   |
| EXTENT OF INJURY TO INMATE(s)     | -                     |
| TREATMENT AFFORDED TO INMATE(s)   | -                     |
| EXTENT OF INJURIES TO OFFICER(s)  | -                     |
| TREATMENT AFFORDED TO OFFICER(s)  | -                     |

Each free-text field spans four table rows, so the rendered form has a fixed
amount of writing space per field. Any renderer has to respect that budget
rather than growing the row.

### Narrative block (table 3)

`STATEMENT OF FACTS (If force used, state type and explain:` - one field, one
open area. Note the unclosed parenthesis; it is in the source.

### Signature and review block (table 4)

| Area                                               | Fields          |
| -------------------------------------------------- | --------------- |
| Signature of Reporting Employee                    | signature, date |
| Signature of Supervisor                            | signature, date |
| Reviewed by Warden/Center Supervisor/Administrator | signature, date |
| RECOMMENDATION (warden level)                      | free text       |
| Reviewed by Assistant Director                     | signature, date |
| RECOMMENDATION (assistant director level)          | free text       |
| Reviewed by Director                               | signature, date |

### Distribution block

`DISTRIBUTION OF COPIES` - original to Assistant Director, then to Director,
then to Inmate Institutional File; copies to Assistant Director and to
Warden/Center Supervisor/Administrator.

## Gap against the current mapping

`official-005-409-mapping.ts` produces four values. Measured against the form:

| Mapped value       | Form field                 | Assessment |
| ------------------ | -------------------------- | ---------- |
| `form005` = `X`    | 005 designation box        | matches    |
| `form409` = `X`/`` | 409 designation box        | matches    |
| `location`         | LOCATION                   | matches    |
| `approximateTime`  | TIME                       | unverified |
| `presence`         | INMATE/EMPLOYEE(s) PRESENT | unverified |

Both unverified values need an owner decision, and the evidence for them is
weaker than it first appeared. An earlier reading of this record claimed the
form contradicted the mapper - that the form "reads `Same as Involved`" and
"expects the word Approximately". That was wrong. Those strings came from the
working copy's pre-filled cells, which have since been cleared. The blank form
says nothing about either.

What remains is a signal, not a rule: one officer completing this form wrote
`Same as Involved` where the mapper emits `Same as above`, and wrote
`Approximately` where the mapper emits `APX.`. That is evidence about unit
practice and worth asking about, but it does not establish what the form
requires.

The remaining fifteen body fields, the narrative, and all seven signature and
review areas have no mapping at all.

## Gate status

| Gate input                  | State                                                       |
| --------------------------- | ----------------------------------------------------------- |
| `authoritative_source_kind` | satisfiable - this is the real form                         |
| `source_sha256`             | satisfiable - recorded above                                |
| `approved_source_revision`  | **blocked** - the form carries no revision date             |
| `approved_field_map`        | **blocked** - two undecided values, fifteen fields unmapped |
| `rendered_fidelity`         | **blocked** - nothing renders the form yet                  |

The gate stays closed. The deterministic mapper remains an approved mapping
component and not an official-form renderer.

## Custody

The source file is not copied into this repository, which does not hold real
operational content. Its hash is recorded above so the exact bytes reviewed can
be re-identified.
