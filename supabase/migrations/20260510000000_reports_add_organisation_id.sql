-- Add organisation_id to reports for faster scoped lookups and RLS
alter table reports
  add column if not exists organisation_id uuid references organisations(id) on delete cascade;

create index if not exists reports_org_player_generated_idx
  on reports (organisation_id, player_id, generated_at desc);

-- Drop old policies and replace with org-scoped versions
drop policy if exists "org members can read reports" on reports;
drop policy if exists "org members can insert reports" on reports;

create policy "org members can read reports"
  on reports for select
  using (
    exists (
      select 1
      from organisation_members om
      join members m on m.id = om.member_id
      where om.organisation_id = reports.organisation_id
        and m.user_id = auth.uid()
    )
  );

create policy "org members can insert reports"
  on reports for insert
  with check (
    exists (
      select 1
      from organisation_members om
      join members m on m.id = om.member_id
      where om.organisation_id = reports.organisation_id
        and m.user_id = auth.uid()
    )
  );
