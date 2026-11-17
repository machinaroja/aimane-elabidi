-- ============ Méthodologie centrale, versions, copie personnelle ============
do $$
declare club uuid := tests.id('club'); item uuid; v1 uuid; v2 uuid; ps uuid; orig jsonb;
begin
  perform tests.login('dt@x.fr');
  insert into methodology_items (club_id, kind, title, created_by) values (club,'philosophy','Position — Possession — Pression', auth.uid()) returning id into item;
  insert into methodology_versions (club_id, item_id, body) values (club, item, '{"texte":"Version 1 des trois piliers"}') returning id into v1;
  perform tests.eq('numérotation automatique v1', (select version_no from methodology_versions where id = v1), 1);
  perform tests.eq('DT voit son brouillon', tests.cnt('select 1 from methodology_items'), 1);
  perform tests.logout();
  perform tests.put('item', item::text); perform tests.put('v1', v1::text);

  perform tests.login('c13a@x.fr');
  perform tests.eq('brouillon invisible pour les éducateurs', tests.cnt('select 1 from methodology_items'), 0);
  perform tests.logout();

  perform tests.login('dt@x.fr');
  perform public.publish_methodology_version(v1);
  perform tests.affects_none('version publiée immuable pour la direction technique (UPDATE)', format($q$update methodology_versions set body = '{}' where id = %L$q$, v1));
  perform tests.affects_none('version publiée non supprimable par la direction technique (DELETE)', format($q$delete from methodology_versions where id = %L$q$, v1));
  insert into methodology_versions (club_id, item_id, body, change_note) values (club, item, '{"texte":"Version 2 enrichie"}', 'ajout pressing') returning id into v2;
  perform tests.eq('v2 reçoit le numéro 2', (select version_no from methodology_versions where id = v2), 2);
  perform tests.logout();
  perform tests.put('v2', v2::text);

  -- Diffusion : tous les éducateurs lisent la v1 publiée ; la v2 (brouillon) reste invisible
  -- Défense en profondeur : même le propriétaire de la base est stoppé par le déclencheur d'immutabilité
  perform tests.fails('déclencheur : version publiée immuable (accès direct base)', format($q$update methodology_versions set body = '{}' where id = %L$q$, v1));
  perform tests.fails('déclencheur : version publiée non supprimable (accès direct base)', format($q$delete from methodology_versions where id = %L$q$, v1));
  perform tests.login('c16a@x.fr');
  perform tests.eq('coach U16A lit l''item publié', tests.cnt('select 1 from methodology_items'), 1);
  perform tests.eq('coach lit seulement la v1 publiée (pas le brouillon v2)', tests.cnt('select 1 from methodology_versions'), 1);
  perform tests.fails('coach ne crée pas d''item commun', format($q$insert into methodology_items (club_id,kind,title) values (%L,'principle','Hack')$q$, club));
  perform tests.fails('coach ne publie pas', format($q$select public.publish_methodology_version(%L)$q$, tests.id('v2')));
  perform tests.affects_none('coach ne modifie pas la méthodologie', $q$update methodology_items set title = 'Hack'$q$);
  perform tests.logout();

  perform tests.login('dt@x.fr'); perform public.publish_methodology_version(v2); perform tests.logout();
  perform tests.login('c16a@x.fr');
  perform tests.eq('après publication v2 : 2 versions lisibles (historique conservé)', tests.cnt('select 1 from methodology_versions'), 2);
  perform tests.eq('la version courante est la v2', (select (current_version_id = tests.id('v2'))::int from methodology_items), 1);
  perform tests.logout();

  -- Copie vers l'espace personnel : original intact, adaptation libre, cloisonnement
  perform tests.login('c13a@x.fr');
  ps := public.copy_to_personal(item, tests.id('t13a'));
  update personal_sessions set body = body || '{"adaptation":"U13 : jeu à 3 touches"}' where id = ps;
  perform tests.eq('la copie personnelle existe', tests.cnt('select 1 from personal_sessions'), 1);
  perform tests.logout();
  perform tests.eq('l''ORIGINAL commun est intact', (select count(*) from methodology_versions where id = tests.id('v2') and body = '{"texte":"Version 2 enrichie"}'), 1);
  perform tests.login('c16a@x.fr');
  perform tests.eq('un autre coach ne voit pas la séance personnelle', tests.cnt('select 1 from personal_sessions'), 0);
  perform tests.affects_none('un autre coach ne modifie pas la séance', 'update personal_sessions set title = ''x''');
  perform tests.logout();
  perform tests.login('dt@x.fr');
  perform tests.eq('la direction technique consulte la séance d''un éducateur', tests.cnt('select 1 from personal_sessions'), 1);
  insert into session_recommendations (club_id, session_id, body) values (club, ps, 'Ajouter une phase de transition');
  perform tests.logout();
  perform tests.login('c13a@x.fr');
  perform tests.eq('le coach lit la recommandation de la direction technique', tests.cnt('select 1 from session_recommendations'), 1);
  perform tests.logout();
  perform tests.login('c16a@x.fr');
  perform tests.fails('un coach ne peut pas recommander sur la séance d''un autre', format($q$insert into session_recommendations (club_id,session_id,body) values (%L,%L,'x')$q$, club, ps));
  perform tests.logout();
end $$;

do $$
declare club uuid := tests.id('club'); n int;
begin
  perform tests.login('c13a@x.fr');
  perform tests.fails('un coach ne génère pas la méthodologie de départ', format($q$select public.seed_methodology_defaults(%L)$q$, club));
  perform tests.logout();
  perform tests.login('dt@x.fr');
  n := public.seed_methodology_defaults(club);
  perform tests.eq('5 contenus de départ créés', n, 5);
  perform tests.logout();
  perform tests.login('c16a@x.fr');
  perform tests.eq('les brouillons de départ restent invisibles aux éducateurs (1 seul item publié)', tests.cnt('select 1 from methodology_items'), 1);
  perform tests.logout();
end $$;
