-- Utilisateurs de test (côté « auth », créés par l'inscription réelle en production).
insert into auth.users (email) values
 ('op@x.fr'),('admin2@x.fr'),('dt@x.fr'),('resp13@x.fr'),('c13a@x.fr'),('c16a@x.fr'),('adj16@x.fr'),('c14a@x.fr'),('out@x.fr'),('stranger@x.fr');
insert into platform_admins select id from auth.users where email in ('op@x.fr','admin2@x.fr');

do $$
declare club uuid; s uuid; cat13 uuid; cat14 uuid; cat16 uuid; t13a uuid; t13b uuid; t14a uuid; t16a uuid; tok text;
begin
  -- 1. Organisation AS Lieusaint
  perform tests.login('op@x.fr');
  club := public.create_club('AS Lieusaint', 'as-lieusaint', '2026-2027', '2026-07-01', '2027-06-30');
  perform tests.put('club', club::text);
  select id into s from seasons where club_id = club;
  -- 2. Catégories (configurables) et 3. équipes (A, B…)
  insert into categories (club_id, name, age_min, age_max, sort_order) values (club,'U13',12,13,13) returning id into cat13;
  insert into categories (club_id, name, age_min, age_max, sort_order) values (club,'U14',13,14,14) returning id into cat14;
  insert into categories (club_id, name, age_min, age_max, sort_order) values (club,'U16',15,16,16) returning id into cat16;
  insert into teams (club_id, season_id, category_id, name) values (club,s,cat13,'A') returning id into t13a;
  insert into teams (club_id, season_id, category_id, name) values (club,s,cat13,'B') returning id into t13b;
  insert into teams (club_id, season_id, category_id, name) values (club,s,cat14,'A') returning id into t14a;
  insert into teams (club_id, season_id, category_id, name) values (club,s,cat16,'A') returning id into t16a;
  perform tests.put('cat13',cat13::text); perform tests.put('cat14',cat14::text); perform tests.put('cat16',cat16::text);
  perform tests.put('t13a',t13a::text); perform tests.put('t13b',t13b::text); perform tests.put('t14a',t14a::text); perform tests.put('t16a',t16a::text);
  -- 4. Invitations des éducateurs
  perform tests.put('tok_dt',   public.create_invitation(club,'dt@x.fr','directeur_technique'));
  perform tests.put('tok_resp', public.create_invitation(club,'resp13@x.fr','responsable_categorie',null,cat13));
  perform tests.put('tok_c13',  public.create_invitation(club,'c13a@x.fr','entraineur',t13a));
  perform tests.put('tok_c16',  public.create_invitation(club,'c16a@x.fr','entraineur',t16a));
  perform tests.put('tok_adj',  public.create_invitation(club,'adj16@x.fr','adjoint',t16a));
  perform tests.put('tok_c14',  public.create_invitation(club,'c14a@x.fr','entraineur',t14a));
  perform tests.logout();
  -- chaque éducateur crée son compte puis accepte son invitation
  perform tests.login('dt@x.fr');     perform public.accept_invitation((select v from tests.ctx where k='tok_dt'));   perform tests.logout();
  perform tests.login('resp13@x.fr'); perform public.accept_invitation((select v from tests.ctx where k='tok_resp')); perform tests.logout();
  perform tests.login('c13a@x.fr');   perform public.accept_invitation((select v from tests.ctx where k='tok_c13'));  perform tests.logout();
  perform tests.login('c16a@x.fr');   perform public.accept_invitation((select v from tests.ctx where k='tok_c16'));  perform tests.logout();
  perform tests.login('adj16@x.fr');  perform public.accept_invitation((select v from tests.ctx where k='tok_adj'));  perform tests.logout();
  perform tests.login('c14a@x.fr');   perform public.accept_invitation((select v from tests.ctx where k='tok_c14'));  perform tests.logout();
end $$;
