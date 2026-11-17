-- ============ Objectifs pédagogiques et évaluations collectives ============
do $$
declare club uuid := tests.id('club'); club2 uuid := tests.id('club2'); n int;
  t13a uuid := tests.id('t13a'); t16a uuid := tests.id('t16a'); cat16 uuid := tests.id('cat16');
  c1 uuid; c2 uuid; c3 uuid; cu16 uuid; obj uuid; obj16 uuid;
begin
  -- ---- grille : définie par la direction technique, propositions inactives
  perform tests.login('c13a@x.fr');
  perform tests.fails('un entraîneur ne génère pas de propositions de critères', format($q$select public.seed_criteria_proposals(%L)$q$, club));
  perform tests.fails('un entraîneur ne crée pas de critère', format($q$insert into criteria (club_id,title,anchors) values (%L,'Pirate','{"1":"aaaaaaaaaaaa","2":"bbbbbbbbbbbb","3":"cccccccccccc","4":"dddddddddddd"}')$q$, club));
  perform tests.logout();
  perform tests.login('dt@x.fr');
  perform tests.eq('6 propositions de critères créées (inactives)', public.seed_criteria_proposals(club), 6);
  perform tests.eq('la direction technique voit les propositions', tests.cnt('select 1 from criteria'), 6);
  perform tests.eq('toutes les propositions sont INACTIVES (à valider)', tests.cnt('select 1 from criteria where active'), 0);
  perform tests.fails('critère sans niveau 4 refusé', format($q$insert into criteria (club_id,title,anchors) values (%L,'Incomplet','{"1":"aaaaaaaaaaaa","2":"bbbbbbbbbbbb","3":"cccccccccccc"}')$q$, club));
  perform tests.fails('niveau décrit trop brièvement refusé', format($q$insert into criteria (club_id,title,anchors) values (%L,'Court','{"1":"a","2":"bbbbbbbbbbbb","3":"cccccccccccc","4":"dddddddddddd"}')$q$, club));
  perform tests.logout();
  perform tests.login('c13a@x.fr');
  perform tests.eq('un entraîneur ne voit AUCUNE proposition non validée', tests.cnt('select 1 from criteria'), 0);
  perform tests.logout();
  perform tests.login('dt@x.fr');
  update criteria set active = true where title in ('Occupation des espaces', 'Circulation du ballon', 'Pressing après perte de balle');   -- validation par la direction technique
  insert into criteria (club_id, title, pillar, anchors, active, category_id) values (club, 'Sortie de balle U16', 'possession',
     '{"1":"La sortie de balle est systématiquement longue.","2":"La sortie courte est tentée mais perdue sous pression.","3":"La sortie courte est réussie contre un pressing à une pointe.","4":"La sortie courte est réussie contre différents pressings, avec adaptation."}', true, cat16) returning id into cu16;
  perform tests.put('cu16', cu16::text);
  select id into c1 from criteria where title = 'Occupation des espaces'; select id into c2 from criteria where title = 'Circulation du ballon'; select id into c3 from criteria where title = 'Pressing après perte de balle';
  perform tests.put('c1', c1::text); perform tests.put('c2', c2::text); perform tests.put('c3', c3::text);
  perform tests.logout();
  perform tests.login('c13a@x.fr');
  perform tests.eq('après validation : 3 critères généraux visibles de l''entraîneur U13 (pas le critère U16 ? il est visible club-wide)', tests.cnt('select 1 from criteria'), 4);
  perform tests.logout();

  -- ---- objectifs
  perform tests.login('c13a@x.fr');
  insert into team_objectives (club_id, team_id, title, description, criterion_id) values (club, t13a, 'Améliorer l''occupation des espaces', 'Travail sur la largeur', c1) returning id into obj;
  perform tests.put('obj', obj::text);
  perform tests.fails('objectif pour une AUTRE équipe refusé', format($q$insert into team_objectives (club_id,team_id,title) values (%L,%L,'Hack U16')$q$, club, t16a));
  perform tests.fails('objectif attribué à un autre auteur refusé', format($q$insert into team_objectives (club_id,team_id,title,created_by) values (%L,%L,'Usurpation',(select id from auth.users where email='dt@x.fr'))$q$, club, t13a));
  update team_objectives set status = 'in_progress' where id = obj;
  perform tests.check('l''entraîneur fait évoluer le statut de son objectif', (select status from team_objectives where id = obj) = 'in_progress');
  perform tests.affects_none('un entraîneur ne supprime pas un objectif (droit réservé)', 'delete from team_objectives');
  perform tests.fails('statut invalide refusé', format($q$update team_objectives set status = 'gagné' where id = %L$q$, obj));
  insert into objective_notes (club_id, objective_id, note) values (club, obj, 'Exercice 4 contre 2 en largeur réalisé deux semaines de suite');
  perform tests.eq('note de suivi enregistrée', tests.cnt('select 1 from objective_notes'), 1);
  perform tests.logout();

  perform tests.login('c16a@x.fr');
  perform tests.eq('coach U16 ne voit pas les objectifs de U13', tests.cnt('select 1 from team_objectives'), 0);
  perform tests.eq('coach U16 ne voit pas les notes de U13', tests.cnt('select 1 from objective_notes'), 0);
  insert into team_objectives (club_id, team_id, title) values (club, t16a, 'Fiabiliser la sortie de balle') returning id into obj16;
  perform tests.put('obj16', obj16::text);
  perform tests.fails('coach U16 n''ajoute pas de note sur un objectif U13', format($q$insert into objective_notes (club_id,objective_id,note) values (%L,%L,'intrusion dans U13')$q$, club, obj));
  perform tests.logout();
  perform tests.login('adj16@x.fr');
  perform tests.eq('adjoint U16 voit l''objectif de son équipe', tests.cnt('select 1 from team_objectives'), 1);
  perform tests.fails('adjoint ne crée pas d''objectif', format($q$insert into team_objectives (club_id,team_id,title) values (%L,%L,'Adjoint trop zélé')$q$, club, t16a));
  perform tests.logout();
  perform tests.login('resp13@x.fr');
  perform tests.eq('responsable U13 voit l''objectif de U13 (sa catégorie) pas celui de U16', tests.cnt('select 1 from team_objectives'), 1);
  insert into team_objectives (club_id, team_id, title) values (club, tests.id('t13b'), 'Objectif posé par le responsable pour U13-B');
  perform tests.logout();
  perform tests.login('dt@x.fr');
  perform tests.eq('direction technique voit tous les objectifs (3)', tests.cnt('select 1 from team_objectives'), 3);
  perform tests.logout();
  perform tests.login('out@x.fr');
  perform tests.eq('inconnu : aucun objectif, aucun critère', tests.cnt('select 1 from team_objectives') + tests.cnt('select 1 from criteria'), 0);
  perform tests.logout();

  -- ---- évaluations
  declare e uuid; e_dt uuid;
  begin
    perform tests.login('c13a@x.fr');
    perform tests.fails('évaluation d''une autre équipe refusée', format($q$select public.create_evaluation(%L, current_date)$q$, t16a));
    perform tests.fails('date future refusée', format($q$select public.create_evaluation(%L, current_date + 30)$q$, t13a));
    e := public.create_evaluation(t13a, current_date - 2, 'Observation du match de samedi');
    perform tests.put('e', e::text);
    perform tests.check('rôle de l''auteur conservé (auto-évaluation)', (select evaluator_role from team_evaluations where id = e) = 'entraineur');
    perform tests.fails('niveau sans observation écrite refusé', format($q$select public.save_evaluation_score(%L,%L,3,NULL)$q$, e, c1));
    perform tests.fails('observation trop courte refusée', format($q$select public.save_evaluation_score(%L,%L,3,'ok')$q$, e, c1));
    perform tests.fails('niveau 5 refusé', format($q$select public.save_evaluation_score(%L,%L,5,'Observation suffisamment longue')$q$, e, c1));
    perform tests.fails('niveau 0 refusé', format($q$select public.save_evaluation_score(%L,%L,0,'Observation suffisamment longue')$q$, e, c1));
    perform tests.fails('critère propre à U16 refusé pour une équipe U13', format($q$select public.save_evaluation_score(%L,%L,3,'Observation suffisamment longue')$q$, e, cu16));
    perform tests.fails('critère inactif (proposition non validée) refusé', format($q$select public.save_evaluation_score(%L,%L,3,'Observation suffisamment longue')$q$, e, (select id from criteria where title = 'Coordination de la pression')));
    perform tests.fails('évaluation vide non finalisable', format($q$select public.finalize_evaluation(%L)$q$, e));
    perform public.save_evaluation_score(e, c1, 2, 'Les latéraux restent proches de l''axe pendant toute la première mi-temps');
    perform public.save_evaluation_score(e, c2, 3, 'Trois changements de côté en construction, rythme régulier');
    perform public.save_evaluation_score(e, c3, 4, 'Reprise collective du ballon en moins de cinq secondes sur quatre pertes');
    perform public.save_evaluation_score(e, c3, NULL);                          -- « non observé » : retiré, jamais de valeur par défaut
    perform tests.eq('2 critères observés (le 3e retiré = non observé)', tests.cnt(format('select 1 from evaluation_scores where evaluation_id = %L', e)), 2);
    perform public.save_evaluation_score(e, c2, 3, 'Trois changements de côté en construction, rythme régulier (corrigé)');
    perform tests.eq('correction du brouillon sans doublon', tests.cnt(format('select 1 from evaluation_scores where evaluation_id = %L', e)), 2);
    perform tests.logout();

    perform tests.login('dt@x.fr');
    perform tests.eq('un brouillon est INVISIBLE de la direction technique', tests.cnt('select 1 from team_evaluations'), 0);
    perform tests.eq('…et ses niveaux aussi', tests.cnt('select 1 from evaluation_scores'), 0);
    perform tests.fails('on ne complète pas le brouillon d''un autre', format($q$select public.save_evaluation_score(%L,%L,4,'Observation suffisamment longue')$q$, e, c1));
    perform tests.fails('on ne finalise pas le brouillon d''un autre', format($q$select public.finalize_evaluation(%L)$q$, e));
    perform tests.logout();
    perform tests.login('resp13@x.fr');
    perform tests.eq('brouillon invisible du responsable', tests.cnt('select 1 from team_evaluations'), 0);
    perform tests.logout();

    perform tests.login('c13a@x.fr');
    perform public.finalize_evaluation(e);
    perform tests.fails('évaluation finalisée : niveau non modifiable', format($q$select public.save_evaluation_score(%L,%L,4,'Observation suffisamment longue')$q$, e, c1));
    perform tests.fails('évaluation finalisée : déjà finalisée', format($q$select public.finalize_evaluation(%L)$q$, e));
    perform tests.affects_none('évaluation finalisée : non supprimable par son auteur', 'delete from team_evaluations');
    perform tests.logout();
    perform tests.fails('déclencheur : une évaluation finalisée est figée même pour le propriétaire de la base', format($q$update team_evaluations set summary = 'réécrite' where id = %L$q$, e));
    perform tests.fails('déclencheur : ses niveaux aussi', format($q$update evaluation_scores set level = 4 where evaluation_id = %L$q$, e));
    perform tests.fails('déclencheur : suppression impossible', format($q$delete from team_evaluations where id = %L$q$, e));

    -- visibilité après finalisation
    perform tests.login('dt@x.fr');
    perform tests.eq('finalisée : visible de la direction technique', tests.cnt('select 1 from team_evaluations'), 1);
    perform tests.eq('…avec ses 2 niveaux et leurs observations', tests.cnt('select 1 from evaluation_scores where length(evidence) > 10'), 2);
    e_dt := public.create_evaluation(t13a, current_date - 1, 'Regard extérieur de la direction technique');
    perform public.save_evaluation_score(e_dt, c1, 3, 'Occupation correcte des couloirs, profondeur insuffisante');
    perform public.finalize_evaluation(e_dt);
    perform tests.check('le regard extérieur est identifié (rôle conservé)', (select evaluator_role from team_evaluations where id = e_dt) = 'directeur_technique');
    perform tests.logout();
    perform tests.login('c13a@x.fr');
    perform tests.eq('l''entraîneur voit les 2 évaluations de son équipe (la sienne et le regard extérieur)', tests.cnt('select 1 from team_evaluations'), 2);
    perform tests.logout();
    perform tests.login('resp13@x.fr');
    perform tests.eq('le responsable de catégorie voit les évaluations finalisées de sa catégorie', tests.cnt('select 1 from team_evaluations'), 2);
    perform tests.logout();
    perform tests.login('c16a@x.fr');
    perform tests.eq('coach U16 ne voit aucune évaluation d''U13', tests.cnt('select 1 from team_evaluations') + tests.cnt('select 1 from evaluation_scores'), 0);
    perform tests.logout();
    perform tests.login('out@x.fr');
    perform tests.eq('inconnu : aucune évaluation', tests.cnt('select 1 from team_evaluations'), 0);
    perform tests.logout();
    perform tests.login('adj16@x.fr');
    perform tests.fails('adjoint ne crée pas d''évaluation', format($q$select public.create_evaluation(%L, current_date)$q$, t16a));
    perform tests.logout();

    -- la grille : un critère utilisé n'est plus modifiable, mais peut être retiré
    perform tests.login('dt@x.fr');
    perform tests.fails('critère déjà utilisé : titre non modifiable', format($q$update criteria set title = 'Renommé après coup' where id = %L$q$, c1));
    perform tests.fails('critère déjà utilisé : niveaux non modifiables', format($q$update criteria set anchors = jsonb_set(anchors, '{1}', '"réécrit après coup pour arranger"') where id = %L$q$, c1));
    perform tests.fails('critère déjà utilisé : non supprimable', format($q$delete from criteria where id = %L$q$, c1));
    update criteria set active = false where id = c1;
    perform tests.check('…mais il peut être retiré de la grille', (select not active from criteria where id = c1));
    perform tests.logout();
    perform tests.login('c13a@x.fr');
    perform tests.check('un critère retiré reste lisible dans les évaluations passées', tests.cnt(format('select 1 from criteria where id = %L', c1)) = 1);
    declare e2 uuid; begin
      e2 := public.create_evaluation(t13a, current_date, 'Nouvelle observation');
      perform tests.fails('un critère retiré n''est plus proposé pour une nouvelle évaluation', format($q$select public.save_evaluation_score(%L,%L,3,'Observation suffisamment longue')$q$, e2, c1));
      delete from team_evaluations where id = e2;                                 -- un brouillon se supprime
      perform tests.check('un brouillon peut être supprimé par son auteur', not exists (select 1 from team_evaluations where id = e2));
    end;
    perform tests.logout();
  end;

  -- ---- garanties transversales
  perform tests.eq('aucune colonne de score global / total / moyenne dans les évaluations',
    (select count(*) from information_schema.columns where table_schema = 'public' and table_name in ('team_evaluations','evaluation_scores')
       and column_name ~* '(total|overall|global|average|moyenne|score$|^note$|rating)'), 0);
  perform tests.eq('RGPD : aucune observation (texte) copiée dans le journal d''audit',
    (select count(*) from audit_log where new_data::text ilike '%latéraux restent proches%' or old_data::text ilike '%latéraux restent proches%' or new_data::text ilike '%Exercice 4 contre 2%'), 0);
  perform tests.check('les saisies d''évaluation sont tracées', (select count(*) from audit_log where table_name = 'evaluation_scores') >= 4);
  perform tests.login('admin2@x.fr');
  perform tests.eq('autre club : aucun critère, objectif ni évaluation du club 1', tests.cnt('select 1 from criteria') + tests.cnt('select 1 from team_objectives') + tests.cnt('select 1 from team_evaluations'), 0);
  perform tests.fails('autre club : une évaluation ne peut pas viser une équipe du club 1', format($q$select public.create_evaluation(%L, current_date)$q$, t13a));
  perform tests.logout();
  perform tests.check('fonctions internes fermées', not has_function_privilege('authenticated', 'app.seed_club_v3(uuid)', 'execute'));
end $$;
