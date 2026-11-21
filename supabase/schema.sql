-- Manual Thinking en línia: esquema de base de dades per a Supabase
-- Executeu aquest fitxer sencer a l'SQL Editor del projecte (botó Run).

-- 1. Taula única de documents
-- Reprodueix el model de documents del prototip (sessions, labels, votes, nuf, tasks, photos)
-- perquè l'eina canviï el mínim possible.
create table if not exists public.docs (
  collection  text        not null,
  id          text        not null,
  sid         text,
  data        jsonb       not null default '{}'::jsonb,
  created_by  uuid        default auth.uid(),
  updated_at  timestamptz not null default now(),
  primary key (collection, id)
);

create index if not exists docs_collection_sid_idx on public.docs (collection, sid);

-- Data d'actualització automàtica
create or replace function public.docs_touch() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists docs_touch on public.docs;
create trigger docs_touch before update on public.docs
  for each row execute function public.docs_touch();

-- 2. Seguretat per files (RLS)
-- Qualsevol persona amb sessió iniciada (també l'accés anònim) pot llegir i escriure.
-- És el mateix nivell d'obertura que el prototip. Es pot restringir més endavant.
alter table public.docs enable row level security;

drop policy if exists "docs: llegir" on public.docs;
create policy "docs: llegir" on public.docs
  for select to authenticated using (true);

drop policy if exists "docs: crear" on public.docs;
create policy "docs: crear" on public.docs
  for insert to authenticated
  with check (collection in ('sessions','labels','votes','nuf','tasks','photos'));

drop policy if exists "docs: modificar" on public.docs;
create policy "docs: modificar" on public.docs
  for update to authenticated using (true)
  with check (collection in ('sessions','labels','votes','nuf','tasks','photos'));

drop policy if exists "docs: esborrar" on public.docs;
create policy "docs: esborrar" on public.docs
  for delete to authenticated using (true);

-- 3. Temps real
alter table public.docs replica identity full;
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'docs'
  ) then
    alter publication supabase_realtime add table public.docs;
  end if;
end $$;

-- 4. Emmagatzematge de fotos
-- Bucket públic de lectura: les fotos es veuen amb l'enllaç, que és llarg i difícil d'endevinar.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('fotos', 'fotos', true, 20971520, array['image/jpeg','image/png','image/webp','image/heic'])
on conflict (id) do nothing;

drop policy if exists "fotos: pujar" on storage.objects;
create policy "fotos: pujar" on storage.objects
  for insert to authenticated with check (bucket_id = 'fotos');

drop policy if exists "fotos: esborrar les pròpies" on storage.objects;
create policy "fotos: esborrar les pròpies" on storage.objects
  for delete to authenticated using (bucket_id = 'fotos' and owner = auth.uid());
