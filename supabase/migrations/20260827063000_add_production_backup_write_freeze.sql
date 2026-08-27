begin;

create table app_private.production_backup_write_freeze (
  singleton_key boolean primary key default true check (singleton_key),
  backup_id text not null check (
    backup_id ~ '^backup-[0-9]{8}T[0-9]{9}Z-[a-f0-9]{16}$'
  ),
  approval_reference text not null check (
    approval_reference ~ '^[A-Za-z0-9][A-Za-z0-9._:/-]{7,159}$'
  ),
  owner_backend_pid integer not null,
  started_at timestamptz not null,
  expires_at timestamptz not null check (expires_at > started_at)
);

comment on table app_private.production_backup_write_freeze is
  'Purpose-bound operator freeze proving the encrypted database and Storage backup was made while Production writes and DDL were blocked.';

create or replace function app_private.begin_production_backup_write_freeze(
  p_backup_id text,
  p_approval_reference text,
  p_expires_at timestamptz
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  lock_key bigint := 764657121624655749;
  freeze_started_at timestamptz := statement_timestamp();
begin
  if p_backup_id is null
    or p_backup_id !~ '^backup-[0-9]{8}T[0-9]{9}Z-[a-f0-9]{16}$' then
    raise exception 'Invalid Production backup freeze identifier';
  end if;
  if p_approval_reference is null
    or p_approval_reference !~ '^[A-Za-z0-9][A-Za-z0-9._:/-]{7,159}$' then
    raise exception 'Invalid Production backup freeze approval';
  end if;
  if p_expires_at is null
    or p_expires_at <= freeze_started_at
    or p_expires_at > freeze_started_at + interval '30 minutes' then
    raise exception 'Invalid Production backup freeze expiry';
  end if;
  if not pg_try_advisory_xact_lock(lock_key) then
    raise exception 'Production writes are active or another backup owns the freeze';
  end if;
  if not exists (
    select 1 from pg_event_trigger
    where evtname = 'guided_operations_backup_freeze_ddl'
      and evtenabled = 'A'
  ) then
    raise exception 'Production backup freeze DDL coverage is incomplete';
  end if;
  if exists (
    select 1
    from pg_class as relation
    join pg_namespace as namespace on namespace.oid = relation.relnamespace
    where namespace.nspname in ('app_private', 'auth', 'storage')
      and relation.relkind in ('r', 'p')
      and has_table_privilege(current_user, relation.oid, 'TRIGGER')
      and not (
        namespace.nspname = 'app_private'
        and relation.relname = 'production_backup_write_freeze'
      )
      and not exists (
        select 1 from pg_trigger as table_trigger
        where table_trigger.tgrelid = relation.oid
          and table_trigger.tgname like 'guided_operations_backup_freeze_%'
          and table_trigger.tgenabled in ('O', 'A')
      )
  ) then
    raise exception 'Production backup freeze table coverage is incomplete';
  end if;
  delete from app_private.production_backup_write_freeze
  where expires_at <= freeze_started_at;
  if exists (select 1 from app_private.production_backup_write_freeze) then
    raise exception 'Another Production backup freeze is active';
  end if;

  insert into app_private.production_backup_write_freeze (
    backup_id, approval_reference, owner_backend_pid, started_at, expires_at
  ) values (
    p_backup_id, p_approval_reference, pg_backend_pid(),
    freeze_started_at, p_expires_at
  );
  return pg_backend_pid();
exception
  when others then
    raise;
end;
$$;

create or replace function app_private.assert_production_backup_write_freeze(
  p_backup_id text,
  p_owner_backend_pid integer
)
returns boolean
language sql
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from app_private.production_backup_write_freeze as backup_freeze
    where backup_freeze.backup_id = p_backup_id
      and backup_freeze.owner_backend_pid = p_owner_backend_pid
      and backup_freeze.owner_backend_pid = pg_backend_pid()
      and backup_freeze.expires_at > statement_timestamp()
  );
$$;

create or replace function app_private.release_production_backup_write_freeze(
  p_backup_id text,
  p_owner_backend_pid integer
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  removed_count integer;
begin
  if p_owner_backend_pid <> pg_backend_pid() then
    return false;
  end if;
  delete from app_private.production_backup_write_freeze
  where backup_id = p_backup_id and owner_backend_pid = p_owner_backend_pid;
  get diagnostics removed_count = row_count;
  if removed_count <> 1 then
    return false;
  end if;
  return true;
end;
$$;

create or replace function app_private.require_no_production_backup_write_freeze()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not pg_try_advisory_xact_lock_shared(764657121624655749) then
    raise exception 'Production writes are temporarily frozen for a protected backup';
  end if;
  if exists (
    select 1 from app_private.production_backup_write_freeze
    where expires_at > statement_timestamp()
  ) then
    raise exception 'Production writes are temporarily frozen for a protected backup';
  end if;
  return null;
end;
$$;

do $$
declare
  target record;
  trigger_name text;
begin
  for target in
    select namespace.nspname as schema_name, relation.relname as table_name
    from pg_class as relation
    join pg_namespace as namespace on namespace.oid = relation.relnamespace
    where namespace.nspname in ('app_private', 'auth', 'storage')
      and relation.relkind in ('r', 'p')
      and has_table_privilege(current_user, relation.oid, 'TRIGGER')
      and not (
        namespace.nspname = 'app_private'
        and relation.relname = 'production_backup_write_freeze'
      )
  loop
    trigger_name := 'guided_operations_backup_freeze_' ||
      substr(md5(target.schema_name || '.' || target.table_name), 1, 16);
    execute format(
      'create trigger %I before insert or update or delete or truncate on %I.%I for each statement execute function app_private.require_no_production_backup_write_freeze()',
      trigger_name,
      target.schema_name,
      target.table_name
    );
  end loop;
end;
$$;

create or replace function app_private.require_no_production_backup_ddl()
returns event_trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not pg_try_advisory_xact_lock_shared(764657121624655749) then
    raise exception 'Production DDL is temporarily frozen for a protected backup';
  end if;
  if exists (
    select 1 from app_private.production_backup_write_freeze
    where expires_at > statement_timestamp()
  ) then
    raise exception 'Production DDL is temporarily frozen for a protected backup';
  end if;
end;
$$;

create event trigger guided_operations_backup_freeze_ddl
on ddl_command_start
execute function app_private.require_no_production_backup_ddl();
alter event trigger guided_operations_backup_freeze_ddl enable always;

alter table app_private.production_backup_write_freeze enable row level security;
alter table app_private.production_backup_write_freeze force row level security;
revoke all on table app_private.production_backup_write_freeze
  from public, anon, authenticated, service_role;
revoke all on function app_private.begin_production_backup_write_freeze(
  text, text, timestamptz
) from public, anon, authenticated, service_role;
revoke all on function app_private.assert_production_backup_write_freeze(
  text, integer
) from public, anon, authenticated, service_role;
revoke all on function app_private.release_production_backup_write_freeze(
  text, integer
) from public, anon, authenticated, service_role;
revoke all on function app_private.require_no_production_backup_write_freeze()
  from public, anon, authenticated, service_role;
revoke all on function app_private.require_no_production_backup_ddl()
  from public, anon, authenticated, service_role;

commit;
