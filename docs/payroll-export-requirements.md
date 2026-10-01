# Payroll leave export — requirements and proposed changes

Status: implemented locally, 1 October 2026. Database installation and payroll acceptance remain outstanding.

The app must export approved leave transactions in the payroll import layout. The current CSV is a general reporting file and does not meet that layout.

## Requirements supplied in the screenshots

Source: “Leave Transactions Layout” and the payroll leave-code screen supplied by the user. These are format references, not instructions to operate payroll.

| Position | Field | Requirement |
| --- | --- | --- |
| 1 | Employee Code | Character, maximum 8 characters |
| 2 | Transaction Code | Character, maximum 4 characters |
| 3 | Pay Out | Character: `Y=Override`, `N=Do not override` |
| 4 | Date From | Character, maximum 10 characters; company-configured format, e.g. `dd/mm/yyyy` |
| 5 | Date To | Character, maximum 10 characters; same company-configured format |
| 6 | Days Taken | Numeric, `3.2 digits` as specified in the screenshot |
| 7 | Remarks | Character, maximum 30 characters |

The conventional interpretation of `3.2 digits` is up to three integer digits and two decimal places. Confirm this with payroll before final acceptance.

| App leave type | Code shown in payroll |
| --- | --- |
| Annual | `0001` |
| Family Responsibility | `0003` |
| Sick | `0020` |

The user confirmed that these screenshots come directly from the payroll system and must be used as the authoritative export specification. Use the three displayed codes for the corresponding leave transactions. Codes for Maternity/Paternity, Study and Unpaid were not supplied; do not invent them. Preserve all codes as text, including leading zeros.

The second screenshot shows balances and entitlements. It does not define a balance import layout. This work covers leave transactions; a balance import would need a separate specification.

## Current implementation findings

- `components/ExportPanel.tsx` downloads eight columns: EmployeeNumber, EmployeeName, LeaveType, StartDate, EndDate, Days, Reference and ApprovedBy. Dates are ISO strings; there are no transaction codes, Pay Out or Remarks fields.
- The button exports every approved request in the queue, including records hidden by search or pagination. There is no payroll period selector or individual request selection.
- The page excludes inactive employees and uses the general reporting start date. Review this for outstanding payroll transactions belonging to departed employees or earlier periods.
- Field lengths, date validity, decimal precision and payroll codes are not validated.
- The API trusts client-supplied request IDs and totals rather than deriving and validating the batch from current source records.
- `lib/exportlog.ts` stores history on the application filesystem; read failures return an empty history. This does not establish durable batch history for the hosted app.
- Requests are locked before the browser downloads the file. There is no saved file or re-download action, and download does not establish that payroll accepted the import.
- The log can discard already-exported IDs while the client still downloads its original rows. Batch membership and file contents need to come from one authoritative server operation.
- The export actor defaults to “Admin” rather than the authenticated user.

These findings are from local source review. The deployed URL could not be read through the web tool; its current rendered state has not been verified.

## Proposed export page

1. Show the payroll format, configured date format and leave-code mappings. Keep the format guide accessible when the request queue is empty.
2. Add an explicit payroll period and request selection. State the date inclusion rule and show selected request, employee and day totals before export. Flag requests crossing the period boundary rather than silently splitting or changing them.
3. Show each selected transaction's seven payroll fields, with employee names and Kissflow references as review context outside the import file.
4. Show row-level validation errors for missing or long employee codes, unmapped leave types, invalid dates, invalid days and oversized remarks. Block batch creation until all selected rows pass. Do not silently truncate codes or remarks.
5. Propose `N` for ordinary leave transactions, subject to payroll confirmation of its meaning. Use a short request reference for Remarks where it fits; keep full source notes in the app.
6. Generate the validated file on the server and save its exact contents, format settings, selected request IDs, totals and authenticated actor in durable storage. Prevent concurrent exports of the same request atomically.
7. Add batch re-download and separate “Exported” from “Imported into payroll”. Re-download must return the saved batch without creating another export. Record payroll confirmation or failure separately.

## File format decisions still required

- Payroll product/version and a known successful import file or full import guide.
- Delimiter (comma, semicolon, tab or other), header presence, quoting rules, encoding and line endings.
- The company date format and accepted Days Taken range/precision.
- Codes for the remaining leave types; the three supplied mappings are authoritative.
- Meaning and default of Pay Out for ordinary leave.
- Payroll period selection rule, treatment of cross-period requests and outstanding leave for departed employees.

Illustrative field values only, not a confirmed importable file:

| Employee Code | Transaction Code | Pay Out | Date From | Date To | Days Taken | Remarks |
| --- | --- | --- | --- | --- | --- | --- |
| 000123 | 0001 | N | 28/09/2026 | 30/09/2026 | 3.00 | KF-EXAMPLE-001 |

## Proposed payroll operator guide

1. Confirm the company import settings and employee/leave-code mappings against payroll.
2. Choose the payroll period and transactions; reconcile the selected totals and resolve validation errors.
3. Create and download the batch. Keep the original downloaded file; opening and re-saving it in a spreadsheet can alter codes and dates.
4. Import using payroll's documented procedure. Reconcile accepted transactions and days against the app's batch totals.
5. Record the import result and payroll reference in the app. If a download fails, re-download the existing batch. If payroll partially accepts it, reconcile the accepted rows before any retry to avoid duplicate transactions.

Exact payroll menu steps will be documented after the product and import guide are supplied.

## Acceptance checks for implementation

- A sample file imports successfully in the actual payroll system with all seven fields in order and leading zeros intact.
- Missing codes, long fields, invalid dates, reversed date ranges, non-finite/invalid days and unmapped types prevent export.
- Server validation rejects ineligible requests and derives totals from authoritative records.
- Selection, preview, saved file and batch history contain the same transactions.
- Concurrent exports cannot include the same transaction twice; persisted history survives application restarts and redeployments.
- A failed download can be recovered from history, and creating an export does not claim a successful payroll import.
- Admin/CFO access remains enforced on export, re-download and import-status actions.

## Implemented operator workflow

The export page now provides the seven-field preview, supplied code mappings, selectable approved transactions, leave-start-date period filters, editable Remarks, row validation and file settings. It includes outstanding requests for departed employees and all source dates. Cross-period transactions retain their full dates and days and are flagged in the preview.

Defaults are `dd/mm/yyyy`, comma delimiter, no header row and `N`. These are proposed defaults where the screenshots are silent. UTF-8, CRLF line endings and quoting for delimiters/quotes are used. Confirm the settings in the page before export. Other leave types remain blocked until their payroll codes are supplied. Days Taken is validated as positive, at most 999.99, with at most two decimal places.

The server re-reads approved requests, validates them, calculates totals, and saves the exact file and actor in Supabase. A unique request claim prevents competing batches from exporting the same request. History provides re-download; import confirmation is documented as a separate manual reconciliation, not yet recorded by the app.

## Database installation and release checks

Apply `supabase/migrations/20261001091136_payroll_exports.sql` to this app's Supabase project before releasing these changes. The connected Supabase tool did not list this app's project, so the migration has not been applied or tested against its database. New batch tables have RLS enabled and no browser-role grants. Only the service role can save/read files or call the atomic save function; app endpoints enforce Admin/CFO access. Storage errors block export rather than falling back to a non-durable log.

Legacy `.vacate-data/export-log.json` is read-only and still supplies previous request locks if present. Before deployment, preserve and migrate any existing batch history into the new storage and request-claim tables. The app cannot recover legacy files that were never saved. Do not assume prior filesystem history survives a hosted redeployment.

Before production use, verify the migration in the actual database: save a sample batch, reject a second batch claiming the same request, verify no partial second batch remains, and confirm browser roles cannot read payroll files. Check role authorization, concurrent exports, re-download and a successful payroll import. The current work has format tests and a production build check; database integration and actual payroll import have not been verified.

Run format checks without installing dependencies:

```sh
npx tsc tests/payroll.test.ts lib/payroll.ts lib/types.ts --outDir /tmp/utf-payroll-tests --module commonjs --target es2020 --esModuleInterop --skipLibCheck
node /tmp/utf-payroll-tests/tests/payroll.test.js
```

Validation completed locally: TypeScript, payroll format tests and `npm run build -- --webpack` passed. The default Turbopack build hit an environment port restriction. The authenticated page has not been visually verified in a browser.

The page presents period filters first, a collapsed file-settings summary, selection totals beside the download action, and an approved-leave table. Import help and previous exports expand on demand. Settings confirmation remains next to the download button and resets when settings change.
