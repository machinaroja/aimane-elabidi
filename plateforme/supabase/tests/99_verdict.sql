do $$ declare bad int; total int; begin
  select count(*) filter (where not ok), count(*) into bad, total from tests.results;
  raise notice 'Bilan : % tests, % échec(s)', total, bad;
  if bad > 0 then raise exception '% test(s) en échec', bad; end if;
end $$;
