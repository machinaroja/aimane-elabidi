-- =============================================================================
-- 0006 : contenus de départ de la méthodologie. Créés en BROUILLON : les
-- orientations par âge sont des propositions à valider par la direction technique,
-- qui les modifie puis les publie (public.publish_methodology_version).
-- =============================================================================
create or replace function public.seed_methodology_defaults(p_club uuid) returns int
language plpgsql security definer set search_path = public, pg_temp as $$
declare n int := 0; v_item uuid;
  r record;
begin
  if not app.has_perm(p_club, null, 'methodology', 'add') then
    raise exception 'droits insuffisants' using errcode = '42501';
  end if;
  for r in select * from (values
    ('philosophy', 'Philosophie de jeu AS Lieusaint : Position — Possession — Pression',
      '{"piliers":["Position","Possession","Pression"],"statut":"proposition à valider par la direction technique"}'::jsonb),
    ('progression', 'Orientations U7–U9',
      '{"themes":["Découverte du ballon","Coordination","Conduite","Jeu","Perception","Plaisir"],"statut":"orientation initiale à valider"}'::jsonb),
    ('progression', 'Orientations U10–U13',
      '{"themes":["Technique","Prise d''information","Jeux de position","Conservation","Coopération","Premiers principes tactiques"],"statut":"orientation initiale à valider"}'::jsonb),
    ('progression', 'Orientations U14–U16',
      '{"themes":["Organisation collective","Possession","Progression","Sortie de balle","Pressing","Transitions","Intelligence tactique"],"statut":"orientation initiale à valider"}'::jsonb),
    ('progression', 'Orientations U17–U18',
      '{"themes":["Maîtrise des principes collectifs","Adaptation aux adversaires","Intensité","Gestion des temps de jeu","Autonomie tactique"],"statut":"orientation initiale à valider"}'::jsonb)
  ) v(kind, title, body)
  loop
    insert into methodology_items (club_id, kind, title, created_by) values (p_club, r.kind, r.title, auth.uid()) returning id into v_item;
    insert into methodology_versions (club_id, item_id, body, change_note, created_by)
      values (p_club, v_item, r.body, 'Création initiale (brouillon)', auth.uid());
    n := n + 1;
  end loop;
  return n;
end $$;
revoke all on function public.seed_methodology_defaults(uuid) from public, anon;
grant execute on function public.seed_methodology_defaults(uuid) to authenticated;
