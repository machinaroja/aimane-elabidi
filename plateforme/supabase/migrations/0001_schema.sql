-- =============================================================================
-- AS LIEUSAINT — Plateforme de gestion sportive multi-catégories
-- 0001 : schéma (clubs, saisons, catégories, équipes, rôles, accès, joueurs,
--        méthodologie, séances personnelles, journal d'audit)
--
-- Règle d'or : TOUTE donnée métier porte club_id. Les clés étrangères sont
-- composites (id, club_id) pour qu'une ligne ne puisse jamais référencer une
-- donnée d'un AUTRE club. Le multi-clubs est donc natif.
-- =============================================================================

create schema if not exists app;

-- ---------- Clubs, saisons, catégories, équipes ------------------------------
create table public.clubs (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (length(trim(name)) > 0),
  slug        text not null unique check (slug ~ '^[a-z0-9-]+$'),
  created_at  timestamptz not null default now()
);

-- Opérateurs de la plateforme (seuls autorisés à créer un nouveau club).
create table public.platform_admins (
  user_id uuid primary key references auth.users(id) on delete cascade
);

create table public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at   timestamptz not null default now()
);

create table public.seasons (
  id         uuid primary key default gen_random_uuid(),
  club_id    uuid not null references public.clubs(id) on delete cascade,
  label      text not null,                       -- ex. « 2026-2027 »
  starts_on  date not null,
  ends_on    date not null,
  is_current boolean not null default false,
  unique (id, club_id),
  unique (club_id, label),
  check (ends_on > starts_on)
);
-- une seule saison courante par club
create unique index seasons_one_current on public.seasons (club_id) where is_current;

-- Catégories 100 % configurables (aucune liste imposée).
create table public.categories (
  id         uuid primary key default gen_random_uuid(),
  club_id    uuid not null references public.clubs(id) on delete cascade,
  name       text not null,                       -- U7, U13, Seniors, Vétérans…
  age_min    int,
  age_max    int,
  sort_order int not null default 0,
  unique (id, club_id),
  unique (club_id, name),
  check (age_min is null or age_max is null or age_min <= age_max)
);

create table public.teams (
  id          uuid primary key default gen_random_uuid(),
  club_id     uuid not null,
  season_id   uuid not null,
  category_id uuid not null,
  name        text not null,                      -- A, B, C, D…
  unique (id, club_id),
  unique (club_id, season_id, category_id, name),
  foreign key (season_id,   club_id) references public.seasons(id, club_id)    on delete cascade,
  foreign key (category_id, club_id) references public.categories(id, club_id) on delete cascade
);

-- ---------- Rôles, permissions, affectations --------------------------------
create table public.club_roles (
  club_id     uuid not null references public.clubs(id) on delete cascade,
  key         text not null check (key ~ '^[a-z_]+$'),
  label       text not null,
  scope_level text not null check (scope_level in ('club','category','team')),
  rank        int  not null,                      -- hiérarchie : on ne délègue que ce qui est plus bas que soi
  primary key (club_id, key)
);

create table public.role_permissions (
  club_id  uuid not null,
  role_key text not null,
  resource text not null check (resource in (
    'club','categories','teams','members','invitations','roles','players',
    'guardians','observations','methodology','personal_sessions','audit_log','reports')),
  action   text not null check (action in ('view','add','edit','delete','export','administer')),
  primary key (club_id, role_key, resource, action),
  foreign key (club_id, role_key) references public.club_roles(club_id, key) on delete cascade
);

create table public.memberships (
  id         uuid primary key default gen_random_uuid(),
  club_id    uuid not null,
  user_id    uuid not null references auth.users(id) on delete cascade,
  role_key   text not null,
  status     text not null default 'active' check (status in ('active','suspended')),
  created_at timestamptz not null default now(),
  unique (id, club_id),
  unique (club_id, user_id, role_key),
  foreign key (club_id, role_key) references public.club_roles(club_id, key)
);

-- Périmètre d'un éducateur : une équipe (rôles « team ») ou une catégorie (rôles « category »).
create table public.assignments (
  id            uuid primary key default gen_random_uuid(),
  club_id       uuid not null,
  membership_id uuid not null,
  team_id       uuid,
  category_id   uuid,
  created_at    timestamptz not null default now(),
  check ((team_id is not null) <> (category_id is not null)),
  foreign key (membership_id, club_id) references public.memberships(id, club_id) on delete cascade,
  foreign key (team_id,       club_id) references public.teams(id, club_id)        on delete cascade,
  foreign key (category_id,   club_id) references public.categories(id, club_id)   on delete cascade
);
create unique index assignments_uniq_team on public.assignments (membership_id, team_id)     where team_id is not null;
create unique index assignments_uniq_cat  on public.assignments (membership_id, category_id) where category_id is not null;

create table public.invitations (
  id          uuid primary key default gen_random_uuid(),
  club_id     uuid not null,
  email       text not null check (email = lower(email)),
  role_key    text not null,
  team_id     uuid,
  category_id uuid,
  token_hash  bytea not null unique,               -- seul le hash SHA-256 est stocké
  invited_by  uuid not null references auth.users(id),
  expires_at  timestamptz not null,
  accepted_at timestamptz,
  accepted_by uuid references auth.users(id),
  revoked_at  timestamptz,
  created_at  timestamptz not null default now(),
  check (team_id is null or category_id is null),
  foreign key (club_id, role_key)    references public.club_roles(club_id, key),
  foreign key (team_id, club_id)     references public.teams(id, club_id)      on delete cascade,
  foreign key (category_id, club_id) references public.categories(id, club_id) on delete cascade
);

-- ---------- Joueurs : UNE fiche par personne au niveau du club ---------------
create table public.players (
  id           uuid primary key default gen_random_uuid(),
  club_id      uuid not null references public.clubs(id) on delete cascade,
  first_name   text not null,
  last_name    text not null,
  birth_date   date,
  license_no   text,
  preferred_foot text check (preferred_foot in ('left','right','both')),
  positions    text[] not null default '{}',
  created_by   uuid references auth.users(id),
  created_at   timestamptz not null default now(),
  unique (id, club_id),
  unique (club_id, license_no)
);

-- Historique des équipes : la fiche ne change jamais, seule la ligne d'équipe courante bouge.
create table public.player_team_history (
  id         uuid primary key default gen_random_uuid(),
  club_id    uuid not null,
  player_id  uuid not null,
  team_id    uuid not null,
  started_on date not null default current_date,
  ended_on   date,                                  -- NULL = équipe actuelle
  check (ended_on is null or ended_on >= started_on),
  foreign key (player_id, club_id) references public.players(id, club_id) on delete cascade,
  foreign key (team_id,   club_id) references public.teams(id, club_id)   on delete restrict
);
create unique index pth_one_current_per_team on public.player_team_history (player_id, team_id) where ended_on is null;

-- Contacts des responsables légaux (mineurs) : table séparée, droits plus stricts.
create table public.player_contacts (
  id         uuid primary key default gen_random_uuid(),
  club_id    uuid not null,
  player_id  uuid not null,
  full_name  text not null,
  relation   text,
  phone      text,
  email      text,
  foreign key (player_id, club_id) references public.players(id, club_id) on delete cascade
);

-- Observations : visibilité explicite (private / team / technical), jamais héritée automatiquement.
create table public.player_observations (
  id         uuid primary key default gen_random_uuid(),
  club_id    uuid not null,
  player_id  uuid not null,
  team_id    uuid not null,                         -- équipe au moment de l'observation
  author_id  uuid not null references auth.users(id),
  visibility text not null default 'private' check (visibility in ('private','team','technical')),
  body       text not null,
  created_at timestamptz not null default now(),
  unique (id, club_id),
  foreign key (player_id, club_id) references public.players(id, club_id) on delete cascade,
  foreign key (team_id,   club_id) references public.teams(id, club_id)   on delete restrict
);

-- Partage explicite d'une observation avec la nouvelle équipe du joueur.
create table public.observation_shares (
  observation_id uuid not null,
  club_id        uuid not null,
  team_id        uuid not null,
  shared_by      uuid not null references auth.users(id),
  shared_at      timestamptz not null default now(),
  primary key (observation_id, team_id),
  foreign key (observation_id, club_id) references public.player_observations(id, club_id) on delete cascade,
  foreign key (team_id, club_id)        references public.teams(id, club_id) on delete cascade
);

-- ---------- Méthodologie centrale (versionnée) -------------------------------
create table public.methodology_items (
  id          uuid primary key default gen_random_uuid(),
  club_id     uuid not null references public.clubs(id) on delete cascade,
  kind        text not null check (kind in (
    'philosophy','principle','document','reference_session','exercise','scheme',
    'objective','behavior','coaching_cue','correction','progression')),
  title       text not null,
  category_id uuid,                                  -- NULL = tout le club
  status      text not null default 'draft' check (status in ('draft','published','archived')),
  current_version_id uuid,
  created_by  uuid references auth.users(id),
  created_at  timestamptz not null default now(),
  unique (id, club_id),
  foreign key (category_id, club_id) references public.categories(id, club_id) on delete set null (category_id)
);

create table public.methodology_versions (
  id           uuid primary key default gen_random_uuid(),
  club_id      uuid not null,
  item_id      uuid not null,
  version_no   int  not null,
  status       text not null default 'draft' check (status in ('draft','published')),
  body         jsonb not null default '{}'::jsonb,   -- contenu structuré (texte, consignes, schémas…)
  change_note  text,
  created_by   uuid references auth.users(id),
  created_at   timestamptz not null default now(),
  published_by uuid references auth.users(id),
  published_at timestamptz,
  unique (id, club_id),
  unique (item_id, version_no),
  foreign key (item_id, club_id) references public.methodology_items(id, club_id) on delete cascade
);
alter table public.methodology_items
  add constraint methodology_items_current_fk
  foreign key (current_version_id) references public.methodology_versions(id) deferrable initially deferred;

-- Qui a consulté quelle version (suivi de diffusion / besoins de formation).
create table public.methodology_reads (
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  club_id    uuid not null,
  version_id uuid not null,
  read_at    timestamptz not null default now(),
  primary key (user_id, version_id),
  foreign key (version_id, club_id) references public.methodology_versions(id, club_id) on delete cascade
);

-- ---------- Bibliothèque personnelle de l'entraîneur -------------------------
create table public.personal_sessions (
  id          uuid primary key default gen_random_uuid(),
  club_id     uuid not null references public.clubs(id) on delete cascade,
  owner_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  team_id     uuid,
  title       text not null,
  body        jsonb not null default '{}'::jsonb,
  is_favorite boolean not null default false,
  source_version_id uuid,                            -- séance commune dont elle est copiée (original intact)
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (id, club_id),
  foreign key (team_id, club_id) references public.teams(id, club_id) on delete set null (team_id),
  foreign key (source_version_id, club_id) references public.methodology_versions(id, club_id) on delete set null (source_version_id)
);

create table public.session_recommendations (
  id         uuid primary key default gen_random_uuid(),
  club_id    uuid not null,
  session_id uuid not null,
  author_id  uuid not null default auth.uid() references auth.users(id),
  body       text not null,
  created_at timestamptz not null default now(),
  foreign key (session_id, club_id) references public.personal_sessions(id, club_id) on delete cascade
);

-- ---------- Journal d'audit (insertion seule) --------------------------------
create table public.audit_log (
  id         bigint generated always as identity primary key,
  club_id    uuid,
  actor_id   uuid,
  action     text not null,                          -- INSERT / UPDATE / DELETE / VIEW / EXPORT
  table_name text not null,
  row_id     text,
  old_data   jsonb,
  new_data   jsonb,
  at         timestamptz not null default now()
);
create index audit_log_club_at on public.audit_log (club_id, at desc);

create index on public.memberships (user_id);
create index on public.assignments (membership_id);
create index on public.player_team_history (team_id) where ended_on is null;
create index on public.teams (category_id);
