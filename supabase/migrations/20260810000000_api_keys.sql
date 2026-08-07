-- Chaves de API públicas (geradas pelo admin em Operações → API).
create table if not exists api_keys (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  key text not null unique,
  is_active boolean not null default true,
  created_by uuid,
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);

alter table api_keys enable row level security;
-- Só admin/supervisor gerencia (via service role nas rotas). Bloqueia acesso anon direto.
drop policy if exists api_keys_admin_all on api_keys;
create policy api_keys_admin_all on api_keys for all to authenticated
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('admin','supervisor')))
  with check (exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('admin','supervisor')));
