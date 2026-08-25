begin;

create table app_private.auth_attempt_events (
  id bigint generated always as identity primary key,
  subject_kind text not null check (
    subject_kind in ('account', 'device', 'network', 'global')
  ),
  subject_digest text not null check (subject_digest ~ '^[a-f0-9]{64}$'),
  outcome text not null check (outcome in ('allowed', 'denied', 'failed')),
  occurred_at timestamptz not null default statement_timestamp(),
  expires_at timestamptz not null,
  check (expires_at > occurred_at)
);

comment on table app_private.auth_attempt_events is
  'Short-lived rate-limit metadata only. Subject values are keyed digests; it never stores raw employee numbers, IP addresses, device identifiers, aliases, or passcodes.';

create index auth_attempt_events_subject_window_idx
  on app_private.auth_attempt_events (subject_kind, subject_digest, occurred_at desc);

create index auth_attempt_events_expiry_idx
  on app_private.auth_attempt_events (expires_at);

alter table app_private.auth_attempt_events enable row level security;
alter table app_private.auth_attempt_events force row level security;

revoke all on table app_private.auth_attempt_events
  from public, anon, authenticated, service_role;

commit;
