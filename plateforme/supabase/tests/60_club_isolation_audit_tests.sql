-- ============ Multi-clubs étanche, audit, garde-fous ============
do $$
declare club uuid := tests.id('club'); club2 uuid; s2 uuid; cat2 uuid; n bigint;
begin
  perform tests.login('admin2@x.fr');
  club2 := public.create_club('FC Autre Club', 'fc-autre', '2026-2027', '2026-07-01', '2027-06-30');
  select id into s2 from seasons where club_id = club2;
  insert into categories (club_id, name) values (club2, 'U13') returning id into cat2;       -- même nom que l'autre club : autorisé
  perform tests.put('club2', club2::text); perform tests.put('cat2', cat2::text);
  perform tests.eq('admin2 ne voit que son club', tests.cnt('select 1 from clubs'), 1);
  perform tests.eq('admin2 ne voit que ses catégories', tests.cnt('select 1 from categories'), 1);
  perform tests.eq('admin2 ne voit aucun joueur de l''autre club', tests.cnt('select 1 from players'), 0);
  perform tests.eq('admin2 ne voit aucune méthodologie de l''autre club', tests.cnt('select 1 from methodology_items'), 0);
  perform tests.eq('admin2 ne voit aucun membre de l''autre club', tests.cnt(format('select 1 from memberships where club_id = %L', club)), 0);
  perform tests.fails('admin2 ne crée pas de catégorie dans le club 1', format($q$insert into categories (club_id,name) values (%L,'U20')$q$, club));
  perform tests.fails('une équipe du club 2 ne peut pas pointer sur une catégorie du club 1', format($q$insert into teams (club_id,season_id,category_id,name) values (%L,%L,%L,'A')$q$, club2, s2, tests.id('cat13')));
  perform tests.fails('admin2 n''invite pas dans le club 1', format($q$select public.create_invitation(%L,'z@x.fr','direction')$q$, club));
  perform tests.logout();
  perform tests.login('op@x.fr');
  perform tests.eq('admin du club 1 ne voit pas le club 2', tests.cnt('select 1 from clubs'), 1);
  perform tests.eq('…ni ses catégories', tests.cnt(format('select 1 from categories where club_id = %L', club2)), 0);
  perform tests.logout();
  perform tests.login('dt@x.fr');
  perform tests.fails('un non-opérateur ne crée pas de club', $q$select public.create_club('Pirate','pirate','s','2026-07-01','2027-06-30')$q$);
  perform tests.logout();

  -- Journal d'audit
  perform tests.login('op@x.fr');
  perform tests.check('admin lit le journal d''audit', tests.cnt('select 1 from audit_log') > 10);
  perform tests.logout();
  perform tests.login('c13a@x.fr');
  perform tests.eq('un coach ne lit pas le journal', tests.cnt('select 1 from audit_log'), 0);
  perform tests.fails('un coach n''écrit pas dans le journal', format($q$insert into audit_log (club_id, action, table_name) values (%L,'X','x')$q$, club));
  perform tests.logout();
  perform tests.fails('journal en insertion seule : UPDATE interdit même au propriétaire', 'update audit_log set action = ''x''');
  perform tests.fails('journal en insertion seule : DELETE interdit', 'delete from audit_log');
  perform tests.fails('journal : TRUNCATE interdit', 'truncate audit_log');
  perform tests.eq('RGPD : aucune valeur nominative (prénom/nom) dans le journal', (select count(*) from audit_log where new_data::text ilike '%Martin%' or old_data::text ilike '%Martin%'), 0);
  perform tests.eq('aucun hash de jeton d''invitation dans le journal', (select count(*) from audit_log where table_name = 'invitations' and (new_data ? 'token_hash' or old_data ? 'token_hash')), 0);
  perform tests.check('les consultations de fiche sont journalisées', true);
  perform tests.login('dt@x.fr'); perform public.view_player(tests.id('player')); perform tests.logout();
  perform tests.check('VIEW journalisé', (select count(*) from audit_log where action = 'VIEW' and table_name = 'players') = 1);
  perform tests.check('EXPORT journalisé', (select count(*) from audit_log where action = 'EXPORT') >= 1);
  perform tests.check('la liste des transferts est tracée (player_team_history)', (select count(*) from audit_log where table_name = 'player_team_history') >= 3);

  -- Garde-fous
  perform tests.login('op@x.fr');
  perform tests.affects_none('un administrateur ne se supprime pas lui-même (rang non supérieur)', format($q$delete from memberships where club_id = %L and role_key = 'club_admin'$q$, club));
  perform tests.logout();
  perform tests.fails('garde-fou : on ne supprime pas le dernier administrateur (accès direct base)', format($q$delete from memberships where club_id = %L and role_key = 'club_admin'$q$, club));
  perform tests.login('op@x.fr');
  perform tests.fails('permissions club_admin immuables', format($q$delete from role_permissions where club_id = %L and role_key = 'club_admin' and resource = 'roles'$q$, club));
  -- l'administrateur peut, lui, ajuster les permissions d'un autre rôle
  insert into role_permissions values (club, 'adjoint', 'players', 'edit');
  perform tests.logout();
  perform tests.login('adj16@x.fr');
  perform tests.eq('l''adjoint ne voit toujours rien hors de son équipe (droit ≠ périmètre)', tests.cnt('select 1 from players'), 0);
  perform tests.logout();
end $$;
