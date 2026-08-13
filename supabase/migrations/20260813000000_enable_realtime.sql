-- TEMPO-REAL ESTAVA MORTO: a publicação `supabase_realtime` estava VAZIA, então as
-- subscriptions de postgres_changes (mensagem nova no ChatWindow, UPDATE na lista de
-- conversas) NUNCA disparavam — tudo dependia do poll (chat 4s, lista 3s), e em aba de
-- segundo plano o navegador estrangula o poll pra ~1x/min. Por isso "o lead respondeu e o
-- atendente não viu em tempo real". Publica as tabelas → entrega instantânea.
do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'messages') then
    alter publication supabase_realtime add table public.messages;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'conversations') then
    alter publication supabase_realtime add table public.conversations;
  end if;
end $$;

-- Caixa-preta: registra o TIPO da msg recebida pra separar reação (não vira mensagem,
-- esperado) de drop de texto real na análise webhook_inbound_log x messages.
alter table webhook_inbound_log add column if not exists msg_type text;
