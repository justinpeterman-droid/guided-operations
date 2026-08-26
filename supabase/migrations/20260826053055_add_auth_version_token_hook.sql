begin;

create or replace function app_private.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  subject_id uuid;
  current_auth_version integer;
  claims jsonb;
begin
  begin
    subject_id := (event->>'user_id')::uuid;
  exception when invalid_text_representation then
    raise exception using errcode = '22023', message = 'Invalid auth hook subject';
  end;

  select account.auth_version
    into current_auth_version
    from app_private.user_accounts as account
    where account.auth_user_id = subject_id;

  claims := coalesce(event->'claims', '{}'::jsonb);
  claims := jsonb_set(
    claims,
    '{app_metadata}',
    coalesce(claims->'app_metadata', '{}'::jsonb),
    true
  );
  claims := jsonb_set(
    claims,
    '{app_metadata,auth_version}',
    to_jsonb(coalesce(current_auth_version, 0)),
    true
  );

  return jsonb_build_object('claims', claims);
end;
$$;

comment on function app_private.custom_access_token_hook(jsonb) is
  'Auth hook that overwrites JWT app_metadata.auth_version from the authoritative account row.';

revoke all on function app_private.custom_access_token_hook(jsonb)
  from public, anon, authenticated, service_role;
grant usage on schema app_private to supabase_auth_admin;
grant execute on function app_private.custom_access_token_hook(jsonb)
  to supabase_auth_admin;

commit;
