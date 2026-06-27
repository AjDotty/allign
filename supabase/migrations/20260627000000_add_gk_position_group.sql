ALTER TABLE players
  DROP CONSTRAINT players_position_group_check;

ALTER TABLE players
  ADD CONSTRAINT players_position_group_check
  CHECK (position_group = ANY (ARRAY['DEF'::text, 'MID'::text, 'ATT'::text, 'GK'::text]));
