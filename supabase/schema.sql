-- AKHI AI: sichere Cloud-Speicherung pro angemeldetem Benutzer
-- In Supabase Dashboard > SQL Editor ausführen.

create table if not exists public.akhi_chats (
  id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'Neuer Chat',
  messages jsonb not null default '[]'::jsonb,
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create index if not exists akhi_chats_user_updated_idx
  on public.akhi_chats (user_id, updated_at desc);

create table if not exists public.akhi_memories (
  user_id uuid primary key references auth.users(id) on delete cascade,
  memories jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.akhi_chats enable row level security;
alter table public.akhi_memories enable row level security;

drop policy if exists "Users manage only their own chats" on public.akhi_chats;
create policy "Users manage only their own chats"
  on public.akhi_chats for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users manage only their own memories" on public.akhi_memories;
create policy "Users manage only their own memories"
  on public.akhi_memories for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

grant select, insert, update, delete on public.akhi_chats to authenticated;
grant select, insert, update, delete on public.akhi_memories to authenticated;
