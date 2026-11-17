-- ============ Fonctions internes fermées (vérification directe des privilèges, pas d'effet de bord) ============
do $$
declare f text; r record;
begin
  foreach f in array array['app.seed_club(uuid)','app.seed_club_v2(uuid)','app.find_conflicts(uuid,uuid,uuid,timestamptz,timestamptz,uuid)',
                           'app.player_in_event_team(uuid,uuid)','app.audit()','app.guard_admin()','app.methodology_version_no()']
  loop
    perform tests.check('fonction interne fermée : ' || f,
      not has_function_privilege('authenticated', f, 'execute') and not has_function_privilege('anon', f, 'execute'));
  end loop;
  -- aucune fonction du schéma public n'est exécutable par anon
  for r in select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname in ('public','app') and p.prokind = 'f' and has_function_privilege('anon', p.oid, 'execute') loop
    perform tests.check('anon ne peut exécuter ' || r.sig, false);
  end loop;
  perform tests.check('anon : aucune fonction exposée', true);
end $$;

-- ============ Installations, calendrier, conflits ============
do $$
declare club uuid := tests.id('club'); t13a uuid := tests.id('t13a'); t16a uuid := tests.id('t16a'); t14a uuid := tests.id('t14a');
  f1 uuid; f2 uuid; e1 uuid; e2 uuid; d timestamptz := date_trunc('day', now()) + interval '10 days 18 hours';
begin
  perform tests.login('dt@x.fr');
  insert into facilities (club_id, name, kind) values (club, 'Terrain A (synthétique)', 'pitch') returning id into f1;
  insert into facilities (club_id, name, kind) values (club, 'Salle vidéo', 'room') returning id into f2;
  insert into facility_closures (club_id, facility_id, starts_at, ends_at, reason) values (club, f2, d + interval '5 days', d + interval '6 days', 'travaux');
  perform tests.logout();
  perform tests.put('f1', f1::text); perform tests.put('f2', f2::text);

  perform tests.login('c13a@x.fr');
  perform tests.eq('coach voit les installations', tests.cnt('select 1 from facilities'), 2);
  perform tests.fails('coach ne crée pas d''installation', format($q$insert into facilities (club_id,name) values (%L,'Pirate')$q$, club));
  e1 := public.create_event(club, t13a, 'training', 'Entraînement U13A', d, d + interval '90 minutes', f1);
  perform tests.put('e1', e1::text);
  perform tests.fails('coach ne crée pas d''événement pour U16', format($q$select public.create_event(%L,%L,'training','X',%L,%L)$q$, club, t16a, d, d + interval '1 hour'));
  perform tests.fails('même équipe, créneau chevauchant : refusé', format($q$select public.create_event(%L,%L,'training','Doublon',%L,%L)$q$, club, t13a, d + interval '30 minutes', d + interval '2 hours'));
  perform tests.fails('installation indisponible (travaux) refusée', format($q$select public.create_event(%L,%L,'training','Vidéo',%L,%L,%L)$q$, club, t13a, d + interval '5 days 1 hour', d + interval '5 days 2 hours', f2));
  perform tests.logout();

  perform tests.login('c16a@x.fr');
  perform tests.fails('autre équipe sur le MÊME terrain au MÊME moment : conflit', format($q$select public.create_event(%L,%L,'training','U16',%L,%L,%L)$q$, club, t16a, d + interval '15 minutes', d + interval '2 hours', f1));
  perform tests.fails('un coach ne peut pas forcer un conflit', format($q$select public.create_event(%L,%L,'training','U16',%L,%L,%L,true)$q$, club, t16a, d + interval '15 minutes', d + interval '2 hours', f1));
  e2 := public.create_event(club, t16a, 'training', 'Entraînement U16A', d + interval '2 hours', d + interval '3 hours 30 minutes', f1);   -- créneau libre
  perform tests.put('e2', e2::text);
  perform tests.eq('coach U16A ne voit pas le planning U13A', tests.cnt('select 1 from events'), 1);
  perform tests.logout();

  perform tests.login('dt@x.fr');
  perform public.create_event(club, t14a, 'training', 'U14A (forcé par la direction technique)', d + interval '10 minutes', d + interval '1 hour', f1, true);
  perform tests.check('la direction technique peut forcer un conflit de terrain', true);
  perform tests.fails('…mais pas un conflit d''équipe', format($q$select public.create_event(%L,%L,'training','Doublon',%L,%L)$q$, club, t14a, d + interval '20 minutes', d + interval '50 minutes'));
  perform public.create_event(club, null, 'meeting', 'Réunion des éducateurs', d + interval '3 days', d + interval '3 days 2 hours');
  perform tests.eq('direction technique voit tout le calendrier (4 événements)', tests.cnt('select 1 from events'), 4);
  perform tests.logout();

  perform tests.login('c13a@x.fr');
  perform tests.eq('coach U13A voit son équipe + l''événement de club (2)', tests.cnt('select 1 from events'), 2);
  perform public.reschedule_event(e1, d + interval '1 day', d + interval '1 day 90 minutes', f1);
  perform tests.check('déplacement libre accepté', (select starts_at from events where id = e1) = d + interval '1 day');
  perform tests.fails('coach ne déplace pas l''événement d''une autre équipe', format($q$select public.reschedule_event(%L,%L,%L,%L)$q$, e2, d + interval '1 day', d + interval '2 days', f1));
  perform tests.fails('coach ne crée pas d''événement de club', format($q$select public.create_event(%L,null,'meeting','x',%L,%L)$q$, club, d, d + interval '1 hour'));
  perform tests.affects_none('modification directe du calendrier interdite', $q$update events set title = 'x'$q$);
  perform tests.affects_none('suppression directe du calendrier interdite', 'delete from events');
  perform tests.logout();
  perform tests.login('out@x.fr');
  perform tests.eq('inconnu ne voit aucun événement', tests.cnt('select 1 from events'), 0);
  perform tests.eq('inconnu ne voit aucune installation', tests.cnt('select 1 from facilities'), 0);
  perform tests.logout();
end $$;

-- ============ Présences, convocations, match, statistiques ============
do $$
declare club uuid := tests.id('club'); t13a uuid := tests.id('t13a'); e1 uuid := tests.id('e1'); e2 uuid := tests.id('e2');
  p1 uuid; p2 uuid; p3 uuid; pout uuid; m uuid; d timestamptz := date_trunc('day', now()) + interval '12 days 15 hours';
begin
  perform tests.login('c13a@x.fr');
  p1 := public.add_player(t13a, 'Lina', 'Durand'); p2 := public.add_player(t13a, 'Hugo', 'Leroy'); p3 := public.add_player(t13a, 'Ines', 'Petit');
  perform tests.put('p1', p1::text); perform tests.put('p2', p2::text); perform tests.put('p3', p3::text);
  perform tests.logout();
  perform tests.login('c16a@x.fr'); pout := public.add_player(tests.id('t16a'), 'Adam', 'Autre'); perform tests.logout();

  -- Présences
  perform tests.login('c13a@x.fr');
  perform public.record_attendance(e1, p1, 'present');
  perform public.record_attendance(e1, p2, 'late', 15, 'bus en retard');
  perform public.record_attendance(e1, p3, 'absent', null, 'grippe');
  perform public.record_attendance(e1, p3, 'excused', null, 'grippe, certificat');          -- correction (mise à jour)
  perform tests.eq('3 présences enregistrées', tests.cnt('select 1 from attendance_records'), 3);
  perform tests.eq('correction appliquée (excused)', tests.cnt($q$select 1 from attendance_records where status = 'excused'$q$), 1);
  perform tests.fails('joueur d''une AUTRE équipe : présence refusée', format($q$select public.record_attendance(%L,%L,'present')$q$, e1, pout));
  perform tests.fails('statut invalide refusé', format($q$select public.record_attendance(%L,%L,'dormant')$q$, e1, p1));
  perform tests.fails('retard hors bornes refusé', format($q$select public.record_attendance(%L,%L,'late',999)$q$, e1, p2));
  perform tests.fails('présence sur l''événement d''une autre équipe refusée', format($q$select public.record_attendance(%L,%L,'present')$q$, e2, p1));
  perform tests.affects_none('modification directe des présences interdite', $q$update attendance_records set status = 'present'$q$);
  perform tests.logout();
  perform tests.login('c16a@x.fr');
  perform tests.eq('coach U16A ne lit pas les présences U13A', tests.cnt('select 1 from attendance_records'), 0);
  perform tests.logout();
  perform tests.login('dt@x.fr');
  perform tests.eq('direction technique lit les présences', tests.cnt('select 1 from attendance_records'), 3);
  perform tests.fails('direction technique ne saisit pas les présences', format($q$select public.record_attendance(%L,%L,'present')$q$, e1, p1));
  perform tests.logout();
  perform tests.login('adj16@x.fr');
  perform tests.eq('adjoint U16A ne lit pas les présences U13A', tests.cnt('select 1 from attendance_records'), 0);
  perform tests.logout();

  -- Match + convocations
  perform tests.login('c13a@x.fr');
  m := public.create_event(club, t13a, 'match', 'U13A - FC Voisin', d, d + interval '100 minutes');
  perform tests.put('m', m::text);
  perform tests.eq('3 joueurs convoqués', public.convoke_players(m, array[p1, p2, p3]), 3);
  perform tests.fails('convoquer un joueur d''une autre équipe refusé', format($q$select public.convoke_players(%L, array[%L::uuid])$q$, m, pout));
  perform public.set_convocation_response(m, p1, 'accepted');
  perform public.set_convocation_response(m, p2, 'declined', 'blessé');
  perform tests.eq('réponses : 1 acceptée, 1 refusée, 1 en attente', tests.cnt($q$select 1 from convocations where status = 'accepted'$q$) * 100
    + tests.cnt($q$select 1 from convocations where status = 'declined'$q$) * 10 + tests.cnt($q$select 1 from convocations where status = 'pending'$q$), 111);
  perform tests.fails('réponse pour un joueur non convoqué refusée', format($q$select public.set_convocation_response(%L,%L,'accepted')$q$, e1, p1));
  perform tests.fails('composition avec un joueur d''une autre équipe refusée', format($q$select public.save_match(%L,'FC Voisin','home','Championnat',null,null,array[%L::uuid])$q$, m, pout));
  perform public.save_match(m, 'FC Voisin', 'home', 'Championnat', null, null, array[p1, p3], 'composition en 4-3-3');
  perform public.save_match(m, 'FC Voisin', 'home', 'Championnat', 3, 1, array[p1, p3], 'victoire 3-1');
  perform tests.eq('résultat enregistré (3-1)', tests.cnt('select 1 from match_details where our_score = 3 and their_score = 1'), 1);
  perform public.record_match_stats(m, p1, 80, 2, 1, 0, 0);
  perform tests.eq('statistiques enregistrées', tests.cnt('select 1 from match_player_stats where goals = 2'), 1);
  perform tests.fails('statistiques invalides refusées (3 jaunes)', format($q$select public.record_match_stats(%L,%L,90,0,0,3,0)$q$, m, p1));
  perform tests.fails('un entraînement n''est pas un match', format($q$select public.save_match(%L,'X','home')$q$, e1));
  perform tests.logout();
  perform tests.login('c16a@x.fr');
  perform tests.eq('coach U16A ne voit ni convocations, ni match, ni stats', tests.cnt('select 1 from convocations') + tests.cnt('select 1 from match_details') + tests.cnt('select 1 from match_player_stats'), 0);
  perform tests.fails('coach U16A ne saisit pas le résultat d''U13A', format($q$select public.save_match(%L,'X','home',null,9,0)$q$, m));
  perform tests.logout();
  perform tests.login('adj16@x.fr');
  perform tests.eq('adjoint (autre équipe) ne voit pas les convocations', tests.cnt('select 1 from convocations'), 0);
  perform tests.logout();
  perform tests.login('resp13@x.fr');
  perform tests.eq('responsable U13 voit convocations, match et présences de sa catégorie', tests.cnt('select 1 from convocations') + tests.cnt('select 1 from match_details') + tests.cnt('select 1 from attendance_records'), 3 + 1 + 3);
  perform tests.logout();

  -- RGPD : notes de présence jamais recopiées dans le journal d'audit
  perform tests.eq('journal : aucune note de présence (grippe / bus) copiée', (select count(*) from audit_log where new_data::text ilike '%grippe%' or new_data::text ilike '%bus en retard%' or old_data::text ilike '%grippe%'), 0);
  perform tests.check('journal : les saisies de présence sont tracées', (select count(*) from audit_log where table_name = 'attendance_records') >= 4);
end $$;
