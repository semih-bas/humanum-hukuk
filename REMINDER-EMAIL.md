# Reminder email delivery

## Who creates and receives reminders

- Any active, email-verified application user can create a reminder, either with a new case or on an existing case.
- Only active, email-verified users with the exact `admin` role receive reminder email. The creator is not automatically a recipient.
- The eligible administrator set is recorded when a reminder becomes due. Newly appointed administrators do not receive old reminders retroactively. Eligibility and the stored email address are rechecked before each send.
- Deactivation, role changes, email changes, verification removal, archived cases, or cancelled reminders cancel affected queued deliveries.
- No SMS is sent. Existing legacy SMS flags do not affect this worker.

## Delivery and safety

The worker polls every 30 seconds. A unique reminder/administrator record and atomic claim prevent concurrent workers from sending the same queued delivery twice. Each recipient receives a separate email; addresses are not exposed to other recipients.

SMTP acceptance does **not** prove inbox delivery. Successful records mean the SMTP server accepted the message. A timeout after message submission, a worker crash, or another uncertain outcome is marked `UNCERTAIN` and is never automatically retried. The administrator page shows that the mail server record needs checking. A stable exactly-once SMTP guarantee is not possible; do not reset uncertain records blindly.

Definite temporary rejection is retried after 5 and 10 minutes, with at most three attempts total. Permanent rejection/authentication errors stop. Quota deferrals stay queued and do not consume retry attempts. Sending and aggregate reminder status are persisted together, with an audit event that excludes passwords, message bodies and raw SMTP errors.

Current conservative limits (rolling inactivity windows, not calendar-day resets):

| Scope | Limit |
| --- | --- |
| Reminder creation per user | 10/hour, 30/day |
| Reminder creation across the application | 200/day |
| Reminder email per administrator | 1/minute, 20/hour, 100/day |
| Reminder sending across the application | 40 attempts/hour, 80% of the shared daily allowance |
| All email categories combined | 50 attempts/hour, `EMAIL_DAILY_LIMIT` (default 300)/day |

Authentication email keeps its own recipient limits. Reminder limits reserve part of the shared budget for account recovery. These are application limits, not a guarantee of provider availability or quota. The dedicated sender should not be used by unrelated tools that consume the same provider quota.

Creation is serialized in the database across both form entry points. Repeated submissions with the same case, title and due time return the existing non-cancelled reminder.

## Isolated acceptance testing

`compose.acceptance.yaml` has an opt-in `notifications` profile. Its reminder worker is pinned to Mailpit (`mailpit:1025`), without SMTP authentication, even if the app environment is later edited. Never change this service to send the bulk acceptance fixtures to the internet.

```sh
docker-compose -f compose.acceptance.yaml --profile notifications up -d --build app reminder-worker
```

Integration check (stop app and worker first, because the check temporarily snapshots shared quota counters):

```sh
docker-compose -f compose.acceptance.yaml --profile notifications stop app reminder-worker
docker-compose -f compose.acceptance.yaml up -d mailpit database
docker-compose -f compose.acceptance.yaml --profile tools run --rm --no-deps -e REMINDER_CHECK_ALLOWED=true fixtures npm run db:check:reminders
docker-compose -f compose.acceptance.yaml --profile notifications up -d app reminder-worker
```

The check only deletes its own uniquely identified database records, restoring quota counters afterward. It leaves one synthetic message in Mailpit for inspection. Existing acceptance cases/documents/users remain intact.

## Dedicated sender / real delivery gate — still required

Production worker deployment is opt-in (`notifications` profile). Configure `REMINDER_EMAIL_ENABLED=true` and `REMINDER_ALLOWED_RECIPIENTS` with the approved administrator addresses in the private app environment. Outside Mailpit, the worker refuses recipients absent from that allowlist and refuses reserved synthetic domains. Update the allowlist deliberately when administrators change. An empty allowlist queues reminders without sending them.

Before enabling real delivery, use a separate controlled test environment and only an explicitly authorized recipient. Confirm verification, reset and reminder receipt, sender name, links, spam placement, expiry/single-use, limits and SMTP failure behavior. Account creation, sender credentials and production approval are not automated by this feature. Secrets must remain outside Git. Dedicated sender setup and real-recipient acceptance are not marked complete by a Mailpit test.

Keep the synthetic fixture set until this gate is passed. Then follow the existing cleanup and security-review roadmap.
