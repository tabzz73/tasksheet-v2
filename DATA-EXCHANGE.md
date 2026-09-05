# TaskSheet V2 — Import and export specification

Status: implementation baseline 4, 2026-09-05. Delegated by ARCHITECTURE.md and subordinate to the controlling suite. ACCESS-CONTROL.md governs authorization and security-domain exclusions. This specifies required behavior; no application import/export feature is claimed implemented by this document.

## 1. Scope and format matrix

Every cell below supports both import and export offline.

| Scope | CSV | Excel | JSON |
| --- | --- | --- | --- |
| Whole Database | ZIP with one UTF-8 CSV per logical table plus manifest.json | One `.xlsx` workbook with one sheet per logical table plus manifest sheet | One `.json` envelope with named table arrays |
| Wound Care Supplies Catalog | One `.csv`, one row per reusable supply item | One `.xlsx` with supplies and metadata sheets | One `.json` catalog envelope |
| Care Tasks Catalog | One `.csv`, discriminated task/modifier/link rows | One `.xlsx` with tasks, modifiers, task-modifier links and metadata sheets | One `.json` envelope with tasks, modifiers and link arrays |

Excel means `.xlsx` in this baseline, not `.xls`, `.xlsm`, macros or cloud spreadsheet synchronization. Label full-database CSV “CSV package (.zip)” before file selection. A single relational table is not a Whole Database export. Exports are independently downloadable files, not live external databases.

## 2. Whole-database completeness

Include every logical application table through an explicit versioned export registry: facility settings and Code of Month, areas/rooms/beds/placement history, residents and status history, shifts and mappings, task catalogs and versions/modifiers, wound supplies, resident/unit tasks and schedule revisions, FYIs/attention/visibility, wound registry/history/supply links and snapshots, bathing requirements/assignments, follow-up occurrences/events, import provenance, print presets and binder-generation metadata where persisted. Empty registered tables are represented explicitly.

Preserve business IDs, relationships, timestamps, effective dates, snapshots, active/inactive state and manual/demo/imported provenance, including inactive/terminal history. Exclude accounts, login names, grants, password/recovery verifiers, sessions, security audit, employee profiles, OS paths, runtime caches and engine internals. Replace actor account IDs on operational events with a non-identifying source marker; the imported marker cannot become a local principal. This round trip preserves business facts but intentionally excludes security identities. Native backups contain security tables and follow ACCESS-CONTROL.md's Administrator-only creation and controlled restore/recovery policy.

Export reads a consistent snapshot and reports its revision. New domain tables cannot ship until registered and covered by round-trip tests. External binary attachments are not implied by current V2 scope; introducing one requires extending this contract, not silently dropping it.

## 3. Canonical metadata and table encoding

Manifest: product `TaskSheet`, exchangeVersion `1`, schemaVersion, scope (`whole_database`, `wound_supplies_catalog`, `care_tasks_catalog`), exportedAt UTC, sourceAppVersion, sourceDatasetRevision, table names/counts, table/sheet mapping, encoding policy and integrity metadata where applicable. Source facility ID is included for full exports only. Catalog exports contain no facility name/address/phone or resident/employee information. Single catalog CSV repeats exchangeVersion/scope on rows; a header-only empty catalog is valid when scope is explicitly selected in the wizard.

Use a versioned schema dictionary for each table: columns, types, nullability, key/foreign-key roles and allowed enum values. Sheet names may use short stable aliases within Excel limits; the manifest maps them to full entity names. Reject unsupported versions or missing required tables. Never silently drop surplus rows/sheets or truncate a workbook to fit Excel limits; offer another format if the dataset cannot fit.

CSV uses quoted fields for embedded commas, quotes and newlines; accept UTF-8 BOM. Excel writes IDs, dates, HHmm and code-like values as text cells, never inferred numeric/date formats. JSON keeps string IDs and canonical ISO local dates/UTC timestamps. All formats preserve `0007`, `0700`, custom room labels and Unicode instructions. Display Active/Inactive in catalog templates and map explicitly to canonical booleans; reject ambiguous truthy values.

For canonical CSV use a documented reversible text escape: literal backslashes are escaped; `\N` denotes null. Prefix an apostrophe for values whose first effective character (after leading whitespace/control characters) is `=`, `+`, `-` or `@`, and for values already beginning with an apostrophe; decode only under the declared canonical policy. This prevents formulas being interpreted on casual spreadsheet opening without silently changing imported text. Raw third-party files do not have their apostrophes stripped by guesswork. CSV cannot force spreadsheet column types; templates/instructions explain importing ID/time columns as text, and full fidelity is tested through TaskSheet's parser.

Excel exchange contains literal values only. Never execute formulas/macros, follow external workbook links or use cached formula results as authoritative data. Formula cells are flagged for correction to literal values. Shared adapter tests verify null/empty distinction, escaped text, numeric precision and date/time preservation.

## 4. Separate catalog schemas

Wound supply item: id, itemCode, name, brand, category, size, unit, packageQuantity, supplier, supplierItemNumber, notes, active, catalogVersion and source metadata. Name/itemCode/unit are required; package quantity, when supplied, is a positive integer. Size is descriptive text; brand and supplier are optional. Item code uniqueness is case-insensitive after trimming. Imported brand products are catalog descriptions, not clinical endorsements. This adds no stock counts, ordering, billing or inventory transactions.

Care task row: id, taskCode, name, category, eligible role, default duration, required staff, default instructions, active, catalogVersion and source metadata. Modifier row: id, modifierCode, name, addedMinutes, minimumStaff, requiredRole when applicable, instructions, active and version. Link row: taskId/modifierId. The single CSV uses `recordType: task | modifier | task_modifier_link`; irrelevant columns remain empty. Excel/JSON use separate tables. Roles reference configured role codes, not employee credentials. Unknown roles/categories require explicit mapping or catalog creation review, never silent guessing.

Task-code and modifier-code uniqueness are enforced separately. Catalog files contain no resident IDs, dates of care, wound assessments or resident-task assignments. Exported catalog dependencies are bundled for the selected scope; unresolved links block import. Existing assignment and wound supply snapshots remain unchanged when the current catalog is updated.

## 5. Import workflow and conflict handling

Authorize every preview, file read, export and commit using ACCESS-CONTROL.md. Whole-business-database export/import and native backup/restore are Administrator-only. Editor catalog/report transfers require explicit scope/action grants; catalog import also needs matching create/update rights and replacement requires deactivation rights. Viewer cannot import/export data files. Do not infer export rights from print rights. Preview tokens include the account/auth revision; revoke them if rights change. Never read unauthorized data into a preview and hide it afterward.

Whole-business-data import preserves receiving accounts/grants/recovery material/security audit. Reject account/security tables in logical imports rather than mapping them to users. A source file cannot create an administrator. Display “All business data; local accounts and security history excluded” next to Whole Database logical exchange. This narrows the earlier full-application-table wording without removing business data coverage.

Use Scope → File/Format → Mapping & Validation → Changes Preview → Confirm. TaskSheet-generated files auto-map by version. Third-party flat catalog files can map headers to required fields with explicit role/category/value mappings. Arbitrary external whole databases are not auto-guessed: they require the canonical schema or an explicit supported migration adapter.

Preview displays table counts, additions, updates, unchanged records, conflicts, deactivations and blocking errors in paged tables; offer a local error report with table/sheet, row/column, code and correction. Ordinary support logs remain redacted. Error reports may contain selected domain context only when necessary and are handled as sensitive local exports; never include OS usernames or employee identities.

Catalog default: add/update with explicit conflict review. Match by stable ID first, then stable item/task/modifier code; a name match is only a suggestion. Conflicting ID/code matches block until resolved. Missing external IDs receive generated stable IDs with a committed mapping. Default conflict choice is keep existing until reviewed. Reimporting identical content returns unchanged, not duplicate records. Command ID plus file/resolution fingerprint makes retries safe.

Catalog Replace scope is optional but explicit: preview deactivates omitted current entries rather than deleting referenced records. It cannot touch the other catalog, residents, facility configuration, operational tasks or snapshots. Whole Database uses replace/restore semantics only: verify source facility identity, create and validate a recoverable native backup, construct the candidate, then activate through ADR-0001. No cross-facility merge. Never treat absent required tables as instructions to empty them.

Full round-trip restore preserves original provenance. Catalog additions record imported source and batch ID; updates preserve record origin and log import change provenance separately so clearing imported data cannot delete pre-existing manual records. Each successful commit has one batch/result record. Cancel, validation failure, stale preview or transaction failure leaves the active database unchanged. No partial-row best-effort commit; unresolved errors must be corrected before confirmation.

## 6. Validation and bounded execution

Validate extension plus actual structure, schema, types, unique keys, all foreign keys, occupancy, schedule invariants, roles, quantities, enums and snapshot references. Detect duplicate IDs within a file, broken links and unsupported future schemas. Reject prohibited employee fields and out-of-scope resident data in catalog files with a clear correction path.

Apply reviewed limits for input bytes, decompressed size, rows/cells, nesting, parse time and string length. Reject ZIP traversal, duplicate paths, encrypted/unsupported workbooks, formula cells and external links. Never execute input code or fetch URLs referenced in data. Bound work in a main-owned worker if parsing threatens UI responsiveness. Show progress and allow cancel before commit; once committing, show its state and wait for the atomic result instead of promising immediate rollback by closing a dialog.

Exports use user-selected file destinations, a temporary output and final rename after successful serialization/validation. No success before the file is available; disk-full/canceled exports do not leave a falsely complete artifact. Output errors and destructive confirmations use separate centered attention dialogs; underlying form drafts/selections remain intact.

## 7. Acceptance matrix

Automate all nine scope/format combinations in both directions using representative fixtures. Compare supported logical records/relationships before and after full round trips, accounting only for explicitly regenerated runtime/migration metadata. Catalog comparisons prove unrelated scopes unchanged. Include empty data, inactive/history records, leading zeros, Unicode/multiline text, null/empty values, formula-like text, duplicate/conflicting IDs, stale preview, repeated import, corrupt input, cancellation, interrupted activation and export write failure.

Also verify desktop offline use, paged selection versus All records, Windows file dialogs, workbook limits, no resident leakage in catalog exports, preserved assignment snapshots, pre-import backup recovery, and compliance with the centered-warning/compact-view rules.
