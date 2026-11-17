-- ============ Isolation par catégorie / équipe / club ============
do $$
declare club uuid := tests.id('club'); n bigint;
begin
  -- Administrateur et direction technique : voient tout
  perform tests.login('op@x.fr');
  perform tests.eq('admin voit 3 catégories', tests.cnt('select 1 from categories'), 3);
  perform tests.eq('admin voit 4 équipes',    tests.cnt('select 1 from teams'), 4);
  perform tests.logout();
  perform tests.login('dt@x.fr');
  perform tests.eq('directeur technique voit 3 catégories', tests.cnt('select 1 from categories'), 3);
  perform tests.eq('directeur technique voit 4 équipes',    tests.cnt('select 1 from teams'), 4);
  perform tests.logout();

  -- Entraîneur U13-A : uniquement SA catégorie et SON équipe
  perform tests.login('c13a@x.fr');
  perform tests.eq('coach U13A voit 1 catégorie (U13)', tests.cnt('select 1 from categories'), 1);
  perform tests.eq('coach U13A voit 1 équipe',          tests.cnt('select 1 from teams'), 1);
  perform tests.eq('coach U13A ne voit pas U16',        tests.cnt($q$select 1 from categories where name = 'U16'$q$), 0);
  perform tests.eq('coach U13A ne voit pas U13-B',      tests.cnt($q$select 1 from teams where name = 'B'$q$), 0);
  perform tests.logout();

  -- Responsable U13 : toute sa catégorie (A et B), rien d'autre
  perform tests.login('resp13@x.fr');
  perform tests.eq('responsable U13 voit ses 2 équipes', tests.cnt('select 1 from teams'), 2);
  perform tests.eq('responsable U13 voit 1 catégorie',   tests.cnt('select 1 from categories'), 1);
  perform tests.logout();

  -- Entraîneur U16-A et adjoint
  perform tests.login('c16a@x.fr');
  perform tests.eq('coach U16A voit 1 équipe', tests.cnt('select 1 from teams'), 1);
  perform tests.eq('coach U16A ne voit pas U13', tests.cnt($q$select 1 from categories where name = 'U13'$q$), 0);
  perform tests.logout();
  perform tests.login('adj16@x.fr');
  perform tests.eq('adjoint U16A voit 1 équipe', tests.cnt('select 1 from teams'), 1);
  perform tests.logout();

  -- Compte sans aucun rôle ; visiteur anonyme
  perform tests.login('out@x.fr');
  perform tests.eq('inconnu : aucun club',    tests.cnt('select 1 from clubs'), 0);
  perform tests.eq('inconnu : aucune équipe', tests.cnt('select 1 from teams'), 0);
  perform tests.eq('inconnu : aucune méthodologie', tests.cnt('select 1 from methodology_items'), 0);
  perform tests.logout();
  declare denied boolean := false; begin
    begin execute 'set local role anon'; perform 1 from public.clubs;
    exception when insufficient_privilege then denied := true; end;
    reset role;
    perform tests.check('anonyme : lecture des clubs refusée', denied);
  end;
end $$;

-- ============ Écritures interdites ============
do $$
declare club uuid := tests.id('club'); s uuid; t16a uuid := tests.id('t16a'); t13a uuid := tests.id('t13a');
begin
  select id into s from seasons where club_id = club;
  perform tests.login('c13a@x.fr');
  perform tests.fails('coach ne crée pas de catégorie', format($q$insert into categories (club_id,name) values (%L,'U99')$q$, club));
  perform tests.fails('coach ne crée pas d''équipe',    format($q$insert into teams (club_id,season_id,category_id,name) values (%L,%L,%L,'Z')$q$, club, s, tests.id('cat13')));
  perform tests.fails('coach n''ajoute pas de joueur dans U16', format($q$select public.add_player(%L,'X','Y')$q$, t16a));
  perform tests.fails('coach ne s''auto-affecte pas à U16', format($q$insert into assignments (club_id,membership_id,team_id) select %L, id, %L from memberships where user_id = auth.uid()$q$, club, t16a));
  perform tests.affects_none('coach ne modifie pas le nom du club', $q$update clubs set name = 'Pirate'$q$);
  perform tests.fails('coach n''élargit pas ses permissions', $q$insert into role_permissions values (tests.id('club'),'entraineur','players','delete')$q$);
  perform tests.fails('coach ne s''invite pas admin', format($q$select public.create_invitation(%L,'z@x.fr','club_admin')$q$, club));
  perform tests.fails('coach n''invite pas hors de son équipe', format($q$select public.create_invitation(%L,'z@x.fr','adjoint',%L)$q$, club, t16a));
  perform tests.affects_none('coach ne change pas son rôle', $q$update memberships set role_key = 'club_admin' where user_id = auth.uid()$q$);
  perform tests.logout();
  perform tests.login('adj16@x.fr');
  perform tests.fails('adjoint n''invite personne', format($q$select public.create_invitation(%L,'z@x.fr','adjoint',%L)$q$, club, t16a));
  perform tests.fails('adjoint n''ajoute pas de joueur', format($q$select public.add_player(%L,'X','Y')$q$, t16a));
  perform tests.logout();
  perform tests.login('resp13@x.fr');
  perform public.create_invitation(club, 'new13@x.fr', 'entraineur', t13a);                      -- autorisé : dans sa catégorie
  perform tests.fails('responsable n''invite pas hors de sa catégorie', format($q$select public.create_invitation(%L,'z@x.fr','entraineur',%L)$q$, club, t16a));
  perform tests.fails('responsable ne crée pas un autre responsable', format($q$select public.create_invitation(%L,'z@x.fr','responsable_categorie',null,%L)$q$, club, tests.id('cat13')));
  perform tests.logout();
end $$;

-- ============ Invitations ============
do $$
declare club uuid := tests.id('club'); tok text;
begin
  perform tests.login('op@x.fr');
  tok := public.create_invitation(club, 'invite@x.fr', 'adjoint', tests.id('t13a'));
  perform tests.logout();
  insert into auth.users (email) values ('invite@x.fr') on conflict do nothing;
  perform tests.login('stranger@x.fr');
  perform tests.fails('jeton volé + mauvaise adresse e-mail', format($q$select public.accept_invitation(%L)$q$, tok));
  perform tests.fails('jeton inventé', $q$select public.accept_invitation('00')$q$);
  perform tests.logout();
  perform tests.login('invite@x.fr');
  perform public.accept_invitation(tok);
  perform tests.fails('jeton à usage unique', format($q$select public.accept_invitation(%L)$q$, tok));
  perform tests.eq('invité voit son équipe après acceptation', tests.cnt('select 1 from teams'), 1);
  perform tests.logout();
  perform tests.eq('le jeton n''est jamais stocké en clair', (select count(*) from invitations where encode(token_hash,'hex') = tok), 0);
  -- invitation expirée
  perform tests.login('op@x.fr');
  tok := public.create_invitation(club, 'invite@x.fr', 'adjoint', tests.id('t16a'), null, 14);
  perform tests.logout();
  update invitations set expires_at = now() - interval '1 day' where token_hash = sha256(convert_to(tok,'UTF8'));
  perform tests.login('invite@x.fr');
  perform tests.fails('invitation expirée refusée', format($q$select public.accept_invitation(%L)$q$, tok));
  perform tests.logout();
end $$;
