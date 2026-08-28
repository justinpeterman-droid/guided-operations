begin;

do $$
declare
  trigger_name text := 'guided_operations_backup_freeze_' ||
    substr(md5('app_private.form_templates'), 1, 16);
begin
  execute format(
    'create trigger %I before insert or update or delete or truncate on app_private.form_templates for each statement execute function app_private.require_no_production_backup_write_freeze()',
    trigger_name
  );
end;
$$;

commit;
