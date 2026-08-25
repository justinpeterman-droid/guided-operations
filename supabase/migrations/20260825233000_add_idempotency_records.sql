begin;

create table app_private.idempotency_records (
  id uuid primary key default gen_random_uuid(),
  actor_account_id uuid not null
    references app_private.user_accounts(auth_user_id) on delete restrict,
  action text not null check (action ~ '^[a-z][a-z0-9_.-]{2,127}$'),
  idempotency_key_digest text not null
    check (idempotency_key_digest ~ '^[a-f0-9]{64}$'),
  request_digest text not null check (request_digest ~ '^[a-f0-9]{64}$'),
  status text not null default 'pending'
    check (status in ('pending', 'succeeded', 'failed')),
  result_reference_id uuid,
  result_code text check (
    result_code is null or result_code ~ '^[a-z][a-z0-9_.-]{2,127}$'
  ),
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  expires_at timestamptz not null,
  unique (actor_account_id, action, idempotency_key_digest),
  check (expires_at > created_at),
  check (
    (status = 'pending' and result_reference_id is null and result_code is null)
    or (status in ('succeeded', 'failed') and result_code is not null)
  )
);

comment on table app_private.idempotency_records is
  'Retry-control metadata only. It never stores request bodies, report narratives, credentials, or response content.';

create index idempotency_records_expiry_idx
  on app_private.idempotency_records (expires_at)
  where status = 'pending';

create or replace function app_private.enforce_idempotency_record_lifecycle()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    if new.actor_account_id is distinct from old.actor_account_id
      or new.action is distinct from old.action
      or new.idempotency_key_digest is distinct from old.idempotency_key_digest
      or new.request_digest is distinct from old.request_digest
      or new.created_at is distinct from old.created_at
      or new.expires_at is distinct from old.expires_at then
      raise exception 'Idempotency identity and request digest are immutable';
    end if;

    if old.status <> 'pending' then
      raise exception 'An idempotency record cannot change after completion';
    end if;

    if new.status = 'pending' then
      raise exception 'An idempotency record must resolve to succeeded or failed';
    end if;

    new.updated_at := statement_timestamp();
  end if;

  return new;
end;
$$;

comment on function app_private.enforce_idempotency_record_lifecycle() is
  'Private guard that prevents a retry key from being repurposed or reopened.';

revoke all on function app_private.enforce_idempotency_record_lifecycle()
  from public, anon, authenticated, service_role;

create trigger idempotency_records_enforce_lifecycle
before update on app_private.idempotency_records
for each row execute function app_private.enforce_idempotency_record_lifecycle();

alter table app_private.idempotency_records enable row level security;
alter table app_private.idempotency_records force row level security;

revoke all on table app_private.idempotency_records
  from public, anon, authenticated, service_role;

commit;
