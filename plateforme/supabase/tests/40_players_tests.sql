-- ============ Joueurs, transfert U13 -> U14, observations ============
do $$
declare club uuid := tests.id('club'); p uuid; n bigint; obs_priv uuid; obs_team uuid;
begin
  perform tests.login('c13a@x.fr');
  p := public.add_player(tests.id('t13a'), 'Yanis', 'Martin', '2013-05-04', 'LIC-001');
  perform tests.put('player', p::text);
  perform tests.eq('coach U13A voit son joueur', tests.cnt('select 1 from players'), 1);
  insert into player_contacts (club_id, player_id, full_name, phone) values (club, p, 'Mme Martin', '0600000000');
  insert into player_observations (club_id, player_id, team_id, author_id, visibility, body)
    values (club, p, tests.id('t13a'), auth.uid(), 'private', 'Note privée : manque de confiance') returning id into obs_priv;
  insert into player_observations (club_id, player_id, team_id, author_id, visibility, body)
    values (club, p, tests.id('t13a'), auth.uid(), 'team', 'Bon pied gauche, à travailler : orientation') returning id into obs_team;
  perform tests.put('obs_priv', obs_priv::text); perform tests.put('obs_team', obs_team::text);
  perform tests.affects_none('coach ne supprime pas de joueur (pas de droit)', 'delete from players');
  perform tests.fails('coach ne peut pas exporter', format($q$select * from public.export_team_players(%L)$q$, tests.id('t13a')));
  perform tests.logout();

  -- Cloisonnement : autres équipes et autres catégories
  perform tests.login('c16a@x.fr');
  perform tests.eq('coach U16A ne voit pas le joueur U13', tests.cnt('select 1 from players'), 0);
  perform tests.eq('coach U16A ne voit pas ses contacts',   tests.cnt('select 1 from player_contacts'), 0);
  perform tests.eq('coach U16A ne voit pas ses observations', tests.cnt('select 1 from player_observations'), 0);
  perform tests.fails('coach U16A ne consulte pas la fiche', format($q$select * from public.view_player(%L)$q$, p));
  perform tests.logout();
  perform tests.login('adj16@x.fr');
  perform tests.eq('adjoint U16A ne voit pas le joueur U13', tests.cnt('select 1 from players'), 0);
  perform tests.logout();
  perform tests.login('out@x.fr');
  perform tests.eq('inconnu ne voit aucun joueur', tests.cnt('select 1 from players'), 0);
  perform tests.logout();

  -- Les observations privées ne sont pas visibles des collègues (même catégorie)
  perform tests.login('resp13@x.fr');
  perform tests.eq('responsable U13 voit le joueur', tests.cnt('select 1 from players'), 1);
  perform tests.eq('responsable voit l''observation d''équipe mais PAS la privée', tests.cnt('select 1 from player_observations'), 1);
  perform tests.eq('responsable : export autorisé (équipe U13A)', (select count(*) from public.export_team_players(tests.id('t13a'))), 1);
  perform tests.logout();
  perform tests.login('dt@x.fr');
  perform tests.eq('DT voit le joueur', tests.cnt('select 1 from players'), 1);
  perform tests.eq('DT ne voit PAS l''observation privée d''un coach', tests.cnt($q$select 1 from player_observations where visibility = 'private'$q$), 0);
  perform tests.logout();
end $$;

-- ---- Passage de catégorie U13 -> U14 : la fiche est conservée, les droits suivent
do $$
declare p uuid := tests.id('player'); t13a uuid := tests.id('t13a'); t14a uuid := tests.id('t14a');
begin
  perform tests.login('c13a@x.fr');
  perform tests.fails('coach U13A seul ne transfère pas vers U14 (pas de droits à l''arrivée)', format($q$select public.transfer_player(%L,%L)$q$, p, t14a));
  perform tests.logout();
  perform tests.login('dt@x.fr');
  perform public.transfer_player(p, t14a);
  perform tests.eq('même identité de joueur (1 seule fiche)', (select count(*) from players where id = p), 1);
  perform tests.eq('l''historique conserve 2 lignes (U13A puis U14A)', tests.cnt(format('select 1 from player_team_history where player_id = %L', p)), 2);
  perform tests.logout();
  -- ancien entraîneur : accès coupé
  perform tests.login('c13a@x.fr');
  perform tests.eq('ancien coach ne voit plus le joueur', tests.cnt('select 1 from players'), 0);
  perform tests.eq('ancien coach ne voit plus ses contacts', tests.cnt('select 1 from player_contacts'), 0);
  perform tests.eq('ancien coach retrouve SA propre observation privée', tests.cnt(format($q$select 1 from player_observations where id = %L$q$, tests.id('obs_priv'))), 1);
  perform tests.logout();
  -- nouvel entraîneur : accès au joueur, pas aux anciennes observations
  perform tests.login('c14a@x.fr');
  perform tests.eq('nouveau coach U14A voit le joueur', tests.cnt('select 1 from players'), 1);
  perform tests.eq('nouveau coach ne voit AUCUNE ancienne observation', tests.cnt('select 1 from player_observations'), 0);
  perform tests.eq('nouveau coach ne voit que la ligne d''historique de son équipe', tests.cnt('select 1 from player_team_history'), 1);
  perform tests.logout();
  -- règles de transfert d'observation : partage explicite par l'auteur, observation d'équipe uniquement
  perform tests.login('c13a@x.fr');
  perform tests.fails('observation privée non partageable', format($q$insert into observation_shares (observation_id, club_id, team_id, shared_by) values (%L,%L,%L,auth.uid())$q$, tests.id('obs_priv'), tests.id('club'), t14a));
  insert into observation_shares (observation_id, club_id, team_id, shared_by) values (tests.id('obs_team'), tests.id('club'), t14a, auth.uid());
  perform tests.logout();
  perform tests.login('c14a@x.fr');
  perform tests.eq('après partage explicite : 1 observation visible (l''observation d''équipe)', tests.cnt('select 1 from player_observations'), 1);
  perform tests.eq('…et jamais la privée', tests.cnt(format($q$select 1 from player_observations where id = %L$q$, tests.id('obs_priv'))), 0);
  perform tests.logout();
  perform tests.login('c16a@x.fr');
  perform tests.eq('un coach d''une autre équipe ne voit toujours rien', tests.cnt('select 1 from player_observations'), 0);
  perform tests.logout();
end $$;
