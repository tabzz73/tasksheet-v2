# TaskSheet V2 — UI/UX and print implementation specification

Status: implementation baseline 2, 2026-09-05. Delegated by PRD.md; subordinate to the controlling suite. Functional behaviors are requirements. Measurements below are proposed first-build defaults pending visual and physical review, not falsely labeled approved samples.

## 1. Reference register

| Reference | Use and status |
| --- | --- |
| PRD and architecture suite | Controlling product and engineering requirements |
| Care Workflow & Architecture Blueprint v3 | Explanatory overview only; not a screen layout or print template; its storage-engine-pending label is superseded by ADR-0001 |
| Earlier TaskSheet UIUX design folder and print samples | Mentioned in project history but not inspected for this revision; agent must locate and inspect before claiming a visual match |
| First working HCA/LPN preview and screenshots | To be produced in phase 1 and recorded as reference candidates, then reviewed |

Record reference filename/version, target screen/document, approval status, and deviations. Missing references do not block the functional first workflow; use these proposed defaults and clearly label visual fidelity unverified. Do not imitate the illustrative blueprint as the app UI.

## 2. Application shell

Desktop baseline at 1280×800: 232px left navigation, 56px context header, 24px content padding, 16px section gaps. At widths below 960px collapse navigation; below 640px use a labeled menu drawer with focus return and touch targets at least 44px. Keep core operations usable at 360px without horizontal scrolling; wide print previews may pan/zoom inside their own region.

Use a system sans-serif font, 14px body, 20–24px page title, semantic panel/ink/accent/warning/danger tokens. Standard rows approximately 44px, adapting to wrapped text. Keep a persistent Demo Mode banner whenever demo-derived operational data remains. No patient imagery, employee avatars, percentage-completion rings or decorative charts without operational purpose.

Header pattern: page title, current date/shift when applicable, one primary action, contextual secondary actions. Quick Add offers Care Task / Unit Task / FYI outside the sidebar. Six primary navigation destinations remain Dashboard, Shifts, Residents, FYI Binder, Print Center, Settings; Help & App exposes User Manual, App Information and Developer Information.

## 3. Screen contracts

| Screen | Required content and actions | Empty/error behavior |
| --- | --- | --- |
| Setup | Facility → Locale → Rooms → Shifts → Clean/Demo choice → Calibration; Back/Next/Save, retained draft | Field-level errors; no seeded shifts without explicit demo selection; preserve progress after save failure |
| Dashboard | Current unit situation, away residents, FYIs, follow-up, Code of Month; Customize and Huddle | No active shift offers configure/select; all widgets hidden offers Customize; expired Code of Month shows configure action |
| Shifts | List/Cards; code, name, role, HHmm range, scheduled count; add/edit/deactivate; row opens workspace | No shifts offers Add Shift; deletion shows references and safe alternative |
| Shift Workspace | Sticky date/shift context, task table, unit tasks, FYIs, warnings; Preview/Print | Missing context asks for explicit selection; zero due tasks distinguished from missing configuration; no care completion buttons |
| Residents | Smart search, status/room filters, natural room order; add and open profile | Search starts empty; no matches distinct from no residents; occupancy collision explains occupied bed |
| Resident Profile | Identity/placement/status header; Care Tasks, Wounds, Bathing, FYIs/Attention sections | Unsaved-change guard; away status shows effective dates; inactive resident cannot acquire current active placement implicitly |
| Task editor | Resident if applicable; role; catalog/snapshot; modifiers; cadence/time; effective dates; shift mapping; visibility | Never auto-select first resident; show next 7 occurrences before save; outside-shift time is an actionable error for that assignment |
| FYI Binder | Facility → Role all shifts → Role/shift sections; Full/Changes Since Last Print preview | No changes explained; no due counts or check-off controls on FYIs |
| Print Center | Date, Quick Print, packages, wound output, specialized documents, report catalog/custom builder | Required date/shift/options validated; unsupported preset shown as unavailable with explanation, never a dead link |
| Bathing editor | One requirement row per resident, prefilled count origin, capacity and locked slots; Generate Proposal/Confirm | Invalid locks block; unmet demand shown by resident; Cancel leaves assignments unchanged |
| Follow-up view | Due date, Day N, carry count, priority, status; explicit status action | Show operational-only explanation; stale update offers reload; duplicate click cannot count twice |
| Huddle | Attention → away residents → urgent FYIs → follow-ups → Code of Month; preview/print | Empty sections omitted from paper; no-current-items state on screen |
| Settings | Facility & Rooms, Shifts, Catalogs, Display & Printing, Data Management, Help & App | Destructive action previews counts/dependencies and backup path; restore errors preserve active store |

All forms have visible labels, field-specific correction hints, explicit save progress and success, and input preserved on failure. Important errors and consequential warnings use the separate centered attention dialog defined in section 7, not a summary panel inside the form. Escape/outside-pointer closes menus; dirty editor dismissal follows section 7. Dialogs use focus containment and return focus. Interactive rows use sibling navigation/action controls, never nested buttons.

## 4. Print defaults for first review

Paper: Letter 8.5×11in, margins 0.4in each, 100%/Actual Size. HCA portrait; LPN/RN landscape; weekly bathing landscape; FYI/Huddle portrait. A4 is an explicit alternate profile requiring its own fit check. Do not silently change page orientation or printer scaling to make content fit.

Font baseline: Arial, body 10pt, table header 9pt bold, facility title 13pt, footer/notice 8pt, line height 1.15. Minimum body 9pt in compact mode; do not auto-shrink below it. Normal rows at least 0.23in with 0.04in vertical padding; Notes and Vitals cells remain blank for handwriting. Use black text and thin gray/black borders with legible monochrome contrast.

| Column | HCA portrait width % | LPN/RN landscape width % |
| --- | ---: | ---: |
| Check box | 4 | 3 |
| Time | 8 | 6 |
| Room | 9 | 7 |
| Resident | 18 | 14 |
| Task | 22 | 20 |
| Important Information | 24 | 22 |
| Vitals / Results | — | 14 |
| Notes / Follow-up (HCA: Notes) | 15 | 14 |

Widths total 100% per profile. Header includes facility contact information, assignment date, shift code/time and role. Footer repeats document identity, generated timestamp and Page X of Y plus the exact PRD guide/source-of-truth notice. Reserve footer space on every page; do not overlap table content. Disable browser-added URL headers/footers in the supported print path.

Wrap long resident/task/instruction text; never ellipsize clinically relevant instructions on paper. Keep rows together when they fit. A row taller than a printable page uses a clearly marked continuation carrying resident and task identity, rather than clipping or microscopic text. Repeat table headings and preserve stable order across pages. Page count is an optimization target, never grounds for dropping tasks or mandatory information.

Preview uses the immutable document model and print stylesheet. Zoom changes the preview viewport only. Changing paper/density regenerates layout for the same content snapshot. Print is user-initiated; canceled dialogs never mark care done or certify a print. FYI binder “last printed” updates only through a deliberate confirmation of successful printing, never merely opening preview.

## 5. Visual and print acceptance

Phase 1 captures desktop/narrow screenshots plus HCA/LPN sample output with fictional data. Review long names, custom rooms, multi-page instructions, no due tasks, overnight windows and all required footer text. Record requested revisions rather than claiming an exact match without a source.

Physical certificate records app/commit, document profile, printer/model, driver/version, paper/orientation, scaling, page count, clipping, wrapping, handwriting room, contrast, repeating headers/footer, date and review outcome. Reviewer identity belongs in the facility-managed evidence record, not the TaskSheet employee database. Automated and physical checks have distinct statuses; physical printing remains pending until performed.

## 6. Smart, content-aware editors

Use one shared editor pattern that adapts to entity, operation, role and entry context. Context awareness is deterministic UI behavior, not an AI service. Prefill a known resident only when the user deliberately opened Add Task from that resident's profile; display the resident clearly. Global Quick Add starts with no resident selected. Unit Tasks omit resident fields; FYIs omit task cadence; wound details appear only for applicable linked work; frequency choices reveal only their relevant schedule inputs.

| Editing need | Presentation |
| --- | --- |
| Short task such as rename shift or edit one setting | Compact centered form dialog |
| Add resident | Steps: Identity → Placement & Status → Review; optional information disclosed in the relevant step |
| Add/edit resident task | Steps: Task & Resident → Schedule & Assignment → Instructions & Visibility → Review, including next occurrences |
| Add/edit unit task or FYI | Short contextual form or a reduced step sequence; no irrelevant resident/care controls |
| Complex resident profile, wound history, catalog or report builder | Dedicated page with section navigation; short inline editing operations may open compact dialogs |
| Import/restore or bulk changes | Dedicated preview/review workflow plus a centered final confirmation; never squeeze the full dataset into a modal |

At 1280×800 and normal text size, common form steps should fit without routine internal scrolling. Proposed dialog widths: 480px for short forms, 720px for stepped editors, always clamped to viewport width minus 32px. Dialog height is content-driven up to viewport height minus 48px; do not reserve an empty full-screen box for a short form. Keep title, entity context, step navigation and action footer visible. If standard content exceeds the available body height, split meaningful sections or use a dedicated page instead of stretching into a tall modal.

Scrolling is an accessibility fallback, not the default layout strategy. At narrow widths, high zoom, software-keyboard display or exceptionally long content, allow one bounded body scroll region. Avoid nested form/panel scrolling, clipped actions and forced minimum heights. On mobile, a full-height step editor may replace the centered form, but attention dialogs remain centered within the usable viewport. Preserve reachable controls at 200% zoom.

Back/Next and section changes retain all draft values. Review shows a compact summary with Edit links to each step; long instructions expand on demand. If errors exist in a hidden step, label that step and provide a direct focus route. Changing task kind or role must not silently erase data; use a centered consequence confirmation before clearing incompatible entries. Do not submit hidden inapplicable fields. No implicit save when switching steps.

## 7. Separate centered attention dialogs

Important warnings and errors must be visually separate from form content and centered over the current application view with a dimmed background. They are not bottom-page banners, inline warning cards or transient toasts. Use a clear title, short explanation, consequence and explicit action labels; optional technical details expand separately. Do not include resident details unnecessarily in an error message.

| Situation | Required response |
| --- | --- |
| Missing or malformed field during editing | Local correction hint; no interrupting dialog on every keystroke |
| Submit with invalid fields or cross-field conflict | Centered summary, such as “Review task details”; “Review fields” returns to and focuses the first invalid field/step; local hints identify corrections |
| Storage/save failure | Centered “Could not save”; preserve draft; offer retry when safe or return to editing; no false success |
| Stale revision/record changed | Centered explanation with review/reload action; never overwrite silently; warn before a reload that would discard edits |
| Delete, clear demo, restore or consequential context change | Centered consequence confirmation with scoped counts and safe default focus |
| Dirty form Cancel/X/Escape/backdrop/navigation/window close | Centered “Discard unsaved changes?” with Keep editing / Discard changes |
| Successful ordinary save | Non-blocking status; close or remain according to the editor's stated action; no unnecessary success modal |

The attention dialog is a sibling overlay, not embedded in the form DOM or layout. Only it traps focus; suspend the underlying editor trap and mark background content inert. Use an accessible dialog/alertdialog with a title and description appropriate to urgency, without competing live announcements. Default focus to Keep editing/Cancel or the safe review action, never the destructive choice. Escape returns safely to editing; clicking its backdrop never discards or confirms. Destructive operations execute only after explicit activation. On closure restore focus to the originating control or invalid field and preserve the active step/scroll position.

Dirty-state detection compares the normalized draft against its baseline; touching a field alone is not dirty, and reverting changes clears dirty state. A pristine Add Resident/Task dialog may close immediately. Successful save resets the baseline. Failed validation or failed save does not. Discard abandons only this editor's uncommitted draft; it does not clear an existing resident/task or other editor state. If saving is in progress, disable duplicate submit and wait for its outcome before resolving a queued close. Normal Electron close requests use the same guard; forced OS termination is outside the guarantee.

Queue/coalesce repeated failures instead of stacking dialogs. After returning from a warning, editing must resume with the same data. Optional Save and close is allowed only where its validation/failure behavior is complete; Keep editing and Discard remain unambiguous defaults.

## 8. Compact Settings, Print Center and collection views

Settings uses a category rail on wide screens and a labeled category selector on narrow screens: Facility & Rooms, Shifts, Catalogs, Display & Printing, Data Management, Help & App. Render one selected category; within it use named sub-sections or tabs, not every form expanded in a single page. Category switches guard unsaved changes, preserve selection and restore navigation predictably. Settings search points to the specific category/field and exposes its containing section.

Print Center uses a persistent date/context toolbar and one active category: Quick Print, Packages, Wounds, Specialized, Report Catalog, Custom Builder. Quick Print is the default. Use compact rows for available outputs with Preview and clear scope labels. Specialized documents and presets are searchable and paged. Custom Builder is stepped: Source → Filters → Columns & Grouping → Layout → Preview; previews live in a dedicated paged view rather than beneath a long configuration form.

Default collection pages show 25 rows, with explicit page size/count controls and search/filter state preserved on return. Virtualization is allowed only with complete keyboard/screen-reader behavior. Do not replace pagination with inaccessible infinite scrolling. Page headers and primary actions stay discoverable; permit natural scrolling where required for accessibility rather than hiding content to meet a fixed height.

Print selection distinguishes “This page” and “All matching results” with total counts. Changing filters reconciles selection visibly. Never treat currently mounted DOM rows as the source of truth for print/CSV scope. A dedicated print preview offers page count, page navigation and fit/zoom controls; continuous preview is optional, not the only way to reach the last page. All hidden categories remain discoverable and every document remains reachable.

## 9. Save ink and paper

Low-ink output is the default for every document, including custom reports and packages. Use white backgrounds, black text, outline checkboxes and thin table rules. Remove decorative logos/illustrations, shadows, colored or dark filled headers, zebra shading, screen navigation, buttons and modal overlays from printed output. Differentiate sections through typography, spacing and thin rules; do not depend on background printing being enabled.

Use compact consolidated tables. Omit empty optional sections and decorative spacers, avoid forced one-page-per-resident or one-page-per-section breaks, and pack compatible sections without separating a heading from its first row. Preserve intentionally blank Notes/Vitals writing cells, approved columns, repeated identity/header/footer and the exact notice. Keep task occurrences distinct: never merge repeated due times or duplicate-looking clinical instructions merely to save lines.

Standard and Compact density profiles adjust permitted spacing within the existing font/row minimums. Compact may reduce excess padding, not font below 9pt body or required handwriting space. Show predicted total pages when switching density; prohibit silent scaling, omitted records, clipped instructions or truncated names. If content still needs extra pages, print the extra pages. HCA stays simpler and denser than LPN/RN; never add its Vitals/Results column by default.

Package generation identifies identical document requests and offers removal of accidental duplicates before rendering. Keep independently distributed shift sheets self-contained even where content repeats. Do not automatically consolidate HCA/LPN or different shifts onto one sheet just to save paper. Blank/calibration outputs may intentionally contain empty regions; do not strip their functional test or handwriting areas. For changes-only binder prints, show the scope so economy does not conceal omitted unchanged sections.

Review representative one-page and multi-page fixtures in monochrome at Actual Size, with browser backgrounds disabled. Record page count and any increase against the previous accepted fixture; investigate wasted space without sacrificing required content. Ink reduction is a design objective verified through absence of unnecessary filled areas; do not invent cartridge-savings percentages.

## 10. Separate data import/export controls

Settings → Data Management provides a scope selector: Whole Database / Wound Care Supplies Catalog / Care Tasks Catalog. Each scope has Import, Export and Download Template where applicable, with CSV / Excel (.xlsx) / JSON format choice. Explain CSV package (.zip) for whole-database data before export. Native Backup/Restore stays separately available. Catalog pages offer shortcuts opening the same scoped workflow, not a second implementation.

Export shows scope and record totals with All records as the complete-scope default; any catalog filtered subset must be explicitly selected/labeled and include required catalog dependencies. Whole Database cannot silently inherit page filters. Catalog exports show that resident data is excluded. Whole exports show sensitive-data handling and source facility context.

Use a dedicated stepped import page: Scope → File/Format → Mapping & Validation → Changes Preview → Confirm. Validation results/conflict rows are paged with filters and direct correction links. Blocking summaries, import failure and final replacement warnings use separate centered attention dialogs, not alerts buried in the wizard form. Whole replacement confirms the facility change and verified backup; catalog replacement states the exact affected scope and deactivations. Retain draft choices when returning to a step; invalidate stale previews before commit. Show counts and a safe result summary only after successful completion.
