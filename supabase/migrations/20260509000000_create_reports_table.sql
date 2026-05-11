-- AI-generated player performance reports cache
create table if not exists reports (
  id             uuid primary key default gen_random_uuid(),
  player_id      uuid not null references players(id) on delete cascade,
  descriptions   jsonb not null,
  generated_at   timestamptz not null default now()
);

-- One active report per player (latest wins)
create index if not exists reports_player_id_generated_at_idx
  on reports (player_id, generated_at desc);

-- RLS: members can read/write reports for players in their organisation
alter table reports enable row level security;

create policy "org members can read reports"
  on reports for select
  using (
    exists (
      select 1
      from players p
      join organisation_members om on om.organisation_id = p.home_organisation_id
      join members m on m.id = om.member_id
      where p.id = reports.player_id
        and m.user_id = auth.uid()
    )
  );

create policy "org members can insert reports"
  on reports for insert
  with check (
    exists (
      select 1
      from players p
      join organisation_members om on om.organisation_id = p.home_organisation_id
      join members m on m.id = om.member_id
      where p.id = reports.player_id
        and m.user_id = auth.uid()
    )
  );
