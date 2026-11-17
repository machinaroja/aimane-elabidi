-- ============ Calendrier officiel (instantané réel SportCorico, 16 équipes) ============
\set payload `cat tests/fixtures/sportcorico_as_lieusaint.json`
insert into tests.ctx values ('payload', :'payload'::text);

do $$
declare club uuid := tests.id('club'); club2 uuid := tests.id('club2'); r jsonb; pl jsonb := (select v::jsonb from tests.ctx where k = 'payload');
  ext_u14 uuid; ext_s1 uuid; e uuid; p uuid; n bigint;
begin
  -- droits d'import
  perform tests.login('c13a@x.fr');
  perform tests.fails('un entraîneur ne peut pas importer le calendrier officiel', format($q$select public.import_external_calendar(%L,'sportcorico',(select v::jsonb from tests.ctx where k='payload'),true)$q$, club));
  perform tests.logout();
  perform tests.login('admin2@x.fr');
  r := public.import_external_calendar(club2, 'sportcorico', pl, false);
  perform tests.eq('sans création de structure : 0 match importé, 16 équipes non reliées', (r ->> 'matches_inserted')::int * 100 + jsonb_array_length(r -> 'teams_unlinked'), 16);
  perform tests.logout();

  -- import complet par l'administrateur du club
  perform tests.login('op@x.fr');
  r := public.import_external_calendar(club, 'sportcorico', pl, true);
  perform tests.eq('352 matchs officiels importés', (r ->> 'matches_inserted')::int, 352);
  perform tests.eq('16 équipes reliées (équipes créées automatiquement)', (r ->> 'teams_created')::int, 16);
  perform tests.eq('catégories : 6 créées (U11, U12, U18, Seniors, Seniors Féminines, Seniors Futsal) ; U13/U14/U16 réutilisées', (r ->> 'categories_created')::int, 6);
  perform tests.eq('11 journées de repos non importées (pas de match)', (r ->> 'rest_days_ignored')::int, 11);
  perform tests.eq('352 événements officiels dans le calendrier', tests.cnt($q$select 1 from events where external_source = 'sportcorico'$q$), 352);
  perform tests.logout();
  perform tests.put('r1', r::text);

  -- exactitude : heure, score, orientation domicile/extérieur
  perform tests.eq('heure exacte : AC Créteil – 22/11/2026 09:30 (heure de Paris)', (select count(*) from events e join match_details d on d.event_id = e.id
     where d.opponent = 'AC Creteil 1' and e.starts_at = timestamptz '2026-11-22 09:30:00+01'), 1);
  perform tests.eq('match joué à domicile : Rungis 0-5 (nous 5)', (select count(*) from match_details where opponent = 'Rungis US 1' and our_score = 5 and their_score = 0 and home_away = 'home' and status = 'played'), 1);
  perform tests.eq('match joué à l''extérieur : Vaux la Rochette 0-2 (nous 2)', (select count(*) from match_details d join events e on e.id = d.event_id
     where d.opponent = 'Vaux la Rochette 2' and e.starts_at::date = '2026-10-04' and d.our_score = 2 and d.their_score = 0 and d.home_away = 'away'), 1);
  perform tests.eq('9 forfaits conservés avec leur statut', (select count(*) from match_details where status = 'forfeit'), 9);
  perform tests.check('heure inconnue signalée pour les matchs passés, jamais inventée', (select count(*) from events e join match_details d on d.event_id = e.id where d.status = 'played' and e.time_known) = 0);
  perform tests.check('tout match à venir a une heure connue', (select count(*) from events e join match_details d on d.event_id = e.id where d.status = 'scheduled' and not e.time_known) = 0);

  -- idempotence : une 2e synchronisation ne crée aucun doublon
  perform tests.login('op@x.fr');
  r := public.import_external_calendar(club, 'sportcorico', pl, true);
  perform tests.eq('2e synchronisation : 0 insertion', (r ->> 'matches_inserted')::int, 0);
  perform tests.eq('2e synchronisation : 352 mises à jour', (r ->> 'matches_updated')::int, 352);
  perform tests.eq('toujours 352 événements officiels (pas de doublon)', tests.cnt($q$select 1 from events where external_source = 'sportcorico'$q$), 352);
  perform tests.eq('toujours 16 équipes créées, pas de doublon d''équipe', tests.cnt($q$select 1 from external_team_links$q$), 16);
  perform tests.logout();
end $$;

-- ============ Cloisonnement et protection des matchs officiels ============
do $$
declare club uuid := tests.id('club'); club2 uuid := tests.id('club2'); pl jsonb := (select v::jsonb from tests.ctx where k = 'payload');
  ext_u14 uuid; ext_s1 uuid; e uuid; p uuid; mem uuid; n bigint; d0 timestamptz;
begin
  select team_id into ext_u14 from external_team_links where club_id = club and external_key = 'lieusaint-foot-as-4';   -- U14 1
  select team_id into ext_s1  from external_team_links where club_id = club and external_key = 'lieusaint-foot-as-1';   -- SENIORS 1
  perform tests.eq('U14 1 est rattachée à la catégorie U14 existante', (select count(*) from teams t join categories c on c.id = t.category_id where t.id = ext_u14 and c.name = 'U14'), 1);
  -- le coach U14 devient responsable de l'équipe « U14 1 »
  select id into mem from memberships where user_id = (select id from auth.users where email = 'c14a@x.fr') and club_id = club;
  insert into assignments (club_id, membership_id, team_id) values (club, mem, ext_u14);

  perform tests.login('c14a@x.fr');
  perform tests.eq('le coach U14 voit les 28 matchs officiels de U14 1', tests.cnt(format('select 1 from events where team_id = %L', ext_u14)), 28);
  perform tests.eq('…et AUCUN match officiel des Seniors 1', tests.cnt(format('select 1 from events where team_id = %L', ext_s1)), 0);
  perform tests.eq('…ni des autres équipes (seuls U14 1, son équipe U14-A et l''événement de club)', tests.cnt(format($q$select 1 from events where external_source = 'sportcorico' and team_id <> %L$q$, ext_u14)), 0);
  select id into e from events where team_id = ext_u14 and starts_at > now() order by starts_at limit 1;
  perform tests.fails('match officiel : non déplaçable par l''entraîneur', format($q$select public.reschedule_event(%L, now() + interval '30 days', now() + interval '30 days 2 hours')$q$, e));
  perform tests.fails('match officiel : non annulable par l''entraîneur', format($q$select public.cancel_event(%L)$q$, e));
  perform tests.affects_none('match officiel : modification directe impossible', $q$update events set starts_at = now() where external_id is not null$q$);
  perform tests.affects_none('match officiel : suppression directe impossible', $q$delete from events where external_id is not null$q$);
  -- l'entraîneur prépare SON match : joueur, convocation, composition, notes
  p := public.add_player(ext_u14, 'Test', 'Joueur');
  perform tests.put('p_ext', p::text); perform tests.put('e_ext', e::text);
  perform tests.logout();
  update player_team_history set started_on = '2026-07-01' where player_id = p;       -- (le test ne dépend pas de la date du jour)
  perform tests.login('c14a@x.fr');
  perform public.convoke_players(e, array[p]);
  perform public.set_convocation_response(e, p, 'accepted');
  perform public.save_match(e, (select opponent from match_details where event_id = e), 'home', null, null, null, array[p], 'plan de jeu : bloc médian');
  perform tests.logout();

  -- nouvelle synchronisation : le travail de l'entraîneur est conservé
  perform tests.login('op@x.fr'); perform public.import_external_calendar(club, 'sportcorico', pl, true); perform tests.logout();
  perform tests.eq('resynchronisation : la composition est conservée', (select jsonb_array_length(lineup) from match_details where event_id = e), 1);
  perform tests.eq('resynchronisation : les notes sont conservées', (select count(*) from match_details where event_id = e and notes = 'plan de jeu : bloc médian'), 1);
  perform tests.eq('resynchronisation : la convocation (acceptée) est conservée', (select count(*) from convocations where event_id = e and status = 'accepted'), 1);

  select starts_at into d0 from events where id = e;
  -- si la compétition décale le match, le calendrier suit (et reste unique)
  update events set starts_at = starts_at + interval '1 day', ends_at = ends_at + interval '1 day' where id = e;     -- simule un état local divergent
  perform tests.login('op@x.fr'); perform public.import_external_calendar(club, 'sportcorico', pl, true); perform tests.logout();
  perform tests.eq('la source officielle fait foi : la date locale divergente est rétablie', (select count(*) from events where id = e and starts_at = d0), 1);
  perform tests.eq('toujours 352 matchs officiels', (select count(*) from events where external_source = 'sportcorico'), 352);

  -- vue par rôle et par club
  perform tests.login('dt@x.fr');
  perform tests.eq('direction technique voit les 352 matchs officiels', tests.cnt($q$select 1 from events where external_source = 'sportcorico'$q$), 352);
  perform tests.fails('la direction technique ne peut pas non plus déplacer un match officiel', format($q$select public.reschedule_event(%L, now() + interval '30 days', now() + interval '31 days')$q$, e));
  perform tests.logout();
  perform tests.login('c16a@x.fr');
  perform tests.eq('coach U16-A (autre équipe) ne voit aucun match officiel', tests.cnt($q$select 1 from events where external_source = 'sportcorico'$q$), 0);
  perform tests.logout();
  perform tests.login('out@x.fr');
  perform tests.eq('inconnu : aucun match officiel', tests.cnt($q$select 1 from events where external_source = 'sportcorico'$q$), 0);
  perform tests.logout();
  perform tests.login('admin2@x.fr');
  perform tests.eq('autre club : aucun match officiel du club 1', tests.cnt($q$select 1 from events where external_source = 'sportcorico'$q$), 0);
  perform tests.eq('autre club : aucune équipe reliée', tests.cnt('select 1 from external_team_links'), 0);
  perform tests.logout();
  perform tests.check('l''importeur n''est pas appelable directement (fonction interne fermée)',
    not has_function_privilege('authenticated', 'app.import_external_calendar(uuid,text,jsonb,boolean)', 'execute'));
  perform tests.check('RGPD : aucun nom de joueur dans le calendrier importé', (select count(*) from events where external_source = 'sportcorico' and title ~* 'Test Joueur') = 0);
end $$;
