# Acceptance cleanup report

Date: 2026-09-03  
Batch: `HH-ACC-20260831-V1`

## Removed test data

- 10 synthetic users
- 30 synthetic case files
- 90 notes
- 62 reminders, including the two scoped real-recipient acceptance reminders
- 60 document records and 60 physical files (20,361 bytes)
- 60 generated case changes
- 26 related audit records
- 24 fixture-recipient quota records

The cleanup was verified against both PostgreSQL and document storage. No record
or physical file from the selected batch remained.

## Preserved data

- 5 users, including the required active verified administrator
- 2 pre-existing case files
- 2 notes, 2 reminders, 2 documents and 7 case changes linked to those files
- The two retained physical documents; both SHA-256 hashes matched their database records
- Migrations, fixture generators, tests, public assets, dependency lock files and ignored local configuration

The two pre-existing case files were deliberately excluded because their ownership
as test data was not confirmed. They require a separate explicit deletion decision.

## Code cleanup

- Centralized repeated case status, date/time and money display helpers.
- Removed CSS classes with no application consumer.
- Hardened fixture cleanup with dry-run-by-default behavior, exact confirmation,
  cross-batch reference checks, safe document quarantine and preserved-data checks.
- Added regression tests for cleanup environment, batch identifier and document path guards.

## Verification

- 54 unit tests passed.
- ESLint and strict TypeScript checks passed.
- The optimized production image compiled successfully.
- Case domain, create and update checks passed without persisting temporary records.
- Email quota and reminder delivery integration checks passed using local Mailpit only.

This report does not claim production readiness. A full repository security review,
deployment configuration and customer acceptance remain separate gates.
