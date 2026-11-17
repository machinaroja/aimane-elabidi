-- =============================================================================
-- Création du club et du premier administrateur. À exécuter dans l'éditeur SQL de Supabase APRÈS :
--   1) les migrations 0001 → 0011 ;
--   2) la création du compte de l'administrateur : Authentication > Users > « Add user » (cochez « Auto Confirm User »).
-- Remplacez les valeurs entre « REMPLACER ».
-- =============================================================================
do $$
declare
  v_email  text := lower('REMPLACER@exemple.fr');            -- adresse du premier administrateur
  v_uid    uuid; v_club uuid;
begin
  select id into v_uid from auth.users where lower(email) = v_email;
  if v_uid is null then raise exception 'Compte introuvable : créez d''abord % dans Authentication > Users', v_email; end if;
  insert into public.platform_admins (user_id) values (v_uid) on conflict do nothing;
  perform set_config('request.jwt.claims', json_build_object('sub', v_uid, 'email', v_email)::text, true);   -- agit « au nom de » cet utilisateur
  v_club := public.create_club('AS Lieusaint', 'as-lieusaint', '2026-2027', date '2026-07-01', date '2027-06-30');
  raise notice 'Club créé : % ; administrateur : %', v_club, v_email;
end $$;
-- Ensuite : l'administrateur ouvre le site, saisit son adresse, reçoit son lien de connexion (il est déjà membre).
