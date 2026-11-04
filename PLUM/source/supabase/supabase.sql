-- PLUM : synchronisation entre appareils (Beta 0.2.31)
-- À coller une seule fois dans Supabase > SQL Editor > New query, puis Run.
-- Une ligne par chose (espace, note/board, tâche, fichier, ordre) avec son contenu en JSON :
-- le format de PLUM peut évoluer sans migration de la base.

create table if not exists public.plum_items (
  user_id    uuid    not null default auth.uid() references auth.users (id) on delete cascade,
  kind       text    not null,               -- space | doc | task | meta | asset
  id         text    not null,
  data       jsonb,
  deleted    boolean not null default false,
  updated_at bigint  not null default 0,     -- heure de la modification sur l'appareil (ms)
  srv_at     timestamptz not null default now(),  -- heure d'arrivée sur le serveur (curseur de lecture)
  primary key (user_id, kind, id)
);
create index if not exists plum_items_user_srv on public.plum_items (user_id, srv_at);

-- La dernière modification gagne : une version plus ancienne qu'en base est ignorée.
create or replace function public.plum_items_stamp() returns trigger
language plpgsql as $$
begin
  if tg_op = 'UPDATE' and new.updated_at < old.updated_at then
    return null;
  end if;
  new.srv_at := clock_timestamp();
  return new;
end $$;
drop trigger if exists plum_items_stamp on public.plum_items;
create trigger plum_items_stamp before insert or update on public.plum_items
  for each row execute function public.plum_items_stamp();

-- Chacun ne voit que ses lignes.
alter table public.plum_items enable row level security;
drop policy if exists "plum own rows" on public.plum_items;
create policy "plum own rows" on public.plum_items for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Temps réel : les autres appareils sont prévenus à chaque changement.
do $$ begin
  alter publication supabase_realtime add table public.plum_items;
exception when duplicate_object then null; end $$;

-- Fichiers (images des notes, boards, moodboards) : dossier privé "plum", un sous-dossier par compte.
insert into storage.buckets (id, name, public) values ('plum', 'plum', false) on conflict (id) do nothing;
drop policy if exists "plum files read" on storage.objects;
drop policy if exists "plum files write" on storage.objects;
drop policy if exists "plum files update" on storage.objects;
drop policy if exists "plum files delete" on storage.objects;
create policy "plum files read" on storage.objects for select to authenticated
  using (bucket_id = 'plum' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "plum files write" on storage.objects for insert to authenticated
  with check (bucket_id = 'plum' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "plum files update" on storage.objects for update to authenticated
  using (bucket_id = 'plum' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "plum files delete" on storage.objects for delete to authenticated
  using (bucket_id = 'plum' and (storage.foldername(name))[1] = auth.uid()::text);
