-- DevHub HQ · 0700 · Telemetry retention.
--
-- Policy (per organization, raw data):
--   events, issue_occurrences      organizations.telemetry_retention_days (default 30)
--   check_results                  90 days
--   metric_samples  60s buckets    14 days
--                   3600s buckets  400 days
--                   86400s buckets kept
--   webhook_deliveries             30 days (processed/duplicate/rejected only)
--   audit_logs                     400 days
--
-- Deletes run in bounded batches so a single call never holds long locks.
-- Schedule with pg_cron on Supabase (see docs/database.md):
--   select cron.schedule('devhub-prune', '*/15 * * * *', $$select app.prune_telemetry(5000)$$);

create function app.prune_telemetry(p_batch integer default 5000)
returns table (table_name text, deleted bigint)
language plpgsql security definer set search_path = ''
as $$
declare
  v_count bigint;
begin
  delete from public.events e
   where e.id in (
     select ev.id from public.events ev
     join public.organizations o on o.id = ev.organization_id
     where ev.received_at < now() - make_interval(days => o.telemetry_retention_days)
     limit p_batch);
  get diagnostics v_count = row_count;
  table_name := 'events'; deleted := v_count; return next;

  delete from public.issue_occurrences io
   where io.id in (
     select x.id from public.issue_occurrences x
     join public.organizations o on o.id = x.organization_id
     where x.occurred_at < now() - make_interval(days => o.telemetry_retention_days)
     limit p_batch);
  get diagnostics v_count = row_count;
  table_name := 'issue_occurrences'; deleted := v_count; return next;

  delete from public.check_results c
   where c.id in (select x.id from public.check_results x where x.checked_at < now() - interval '90 days' limit p_batch);
  get diagnostics v_count = row_count;
  table_name := 'check_results'; deleted := v_count; return next;

  delete from public.metric_samples m
   where m.id in (
     select x.id from public.metric_samples x
     where (x.bucket_seconds = 60 and x.bucket_start < now() - interval '14 days')
        or (x.bucket_seconds = 3600 and x.bucket_start < now() - interval '400 days')
     limit p_batch);
  get diagnostics v_count = row_count;
  table_name := 'metric_samples'; deleted := v_count; return next;

  delete from public.webhook_deliveries w
   where w.id in (
     select x.id from public.webhook_deliveries x
     where x.received_at < now() - interval '30 days' and x.status in ('processed', 'duplicate', 'rejected')
     limit p_batch);
  get diagnostics v_count = row_count;
  table_name := 'webhook_deliveries'; deleted := v_count; return next;

  perform set_config('app.allow_audit_prune', 'on', true);
  delete from public.audit_logs a
   where a.id in (select x.id from public.audit_logs x where x.created_at < now() - interval '400 days' limit p_batch);
  get diagnostics v_count = row_count;
  perform set_config('app.allow_audit_prune', 'off', true);
  table_name := 'audit_logs'; deleted := v_count; return next;
end
$$;

revoke all on function app.prune_telemetry(integer) from public, authenticated;
grant execute on function app.prune_telemetry(integer) to service_role;
