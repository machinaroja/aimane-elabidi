-- ============ Profils identifiables et export de rapports ============
do $$
declare club uuid := tests.id('club');
begin
  perform tests.check('l''adresse e-mail est copiée dans le profil à l''acceptation', (select email from profiles where id = (select id from auth.users where email = 'c13a@x.fr')) = 'c13a@x.fr');
  perform tests.check('le profil du créateur du club porte aussi son e-mail', (select email from profiles where id = (select id from auth.users where email = 'op@x.fr')) = 'op@x.fr');

  perform tests.login('dt@x.fr');
  perform tests.check('direction technique : voit l''identité des éducateurs', tests.cnt('select 1 from profiles where email is not null') >= 6);
  perform public.log_report_export(club, 'rapport mensuel 2026-11');
  perform tests.logout();
  perform tests.check('export de rapport journalisé (acteur + libellé)', (select count(*) from audit_log where action = 'EXPORT' and table_name = 'reports' and row_id = 'rapport mensuel 2026-11') = 1);

  perform tests.login('c13a@x.fr');
  perform tests.fails('un entraîneur ne peut pas exporter de rapport', format($q$select public.log_report_export(%L,'x')$q$, club));
  perform tests.check('un entraîneur ne voit que ses collègues de SON équipe (responsable U13 + adjoint), ni la direction technique ni les autres équipes',
    (select string_agg(email, ',' order by email) from profiles where id <> auth.uid()) = 'invite@x.fr,resp13@x.fr');
  perform tests.affects_none('un entraîneur ne modifie pas le profil d''un autre', $q$update profiles set display_name = 'Pirate' where id <> auth.uid()$q$);
  update profiles set display_name = 'Coach U13' where id = auth.uid();
  perform tests.logout();
  perform tests.check('chacun peut renseigner son propre nom', (select display_name from profiles where id = (select id from auth.users where email = 'c13a@x.fr')) = 'Coach U13');

  perform tests.login('out@x.fr');
  perform tests.eq('un compte sans rôle ne voit aucun profil', tests.cnt('select 1 from profiles'), 0);
  perform tests.logout();
  perform tests.login('admin2@x.fr');
  perform tests.eq('l''autre club ne voit aucun profil du club 1', tests.cnt('select 1 from profiles where email = ''c13a@x.fr'''), 0);
  perform tests.logout();
end $$;
