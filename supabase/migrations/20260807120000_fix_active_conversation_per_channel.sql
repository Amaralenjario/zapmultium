-- FIX: o índice idx_one_active_per_customer forçava apenas UMA conversa ativa
-- por cliente, o que quebra o multi-número: quando o mesmo lead (mesmo telefone)
-- fala com um segundo número (outra operação), o webhook não conseguia criar a
-- nova conversa (violação do índice) e a mensagem/lead se perdia.
--
-- Correção: permitir uma conversa ativa por cliente POR NÚMERO (phone_number_id).
DROP INDEX IF EXISTS idx_one_active_per_customer;

CREATE UNIQUE INDEX IF NOT EXISTS idx_one_active_per_customer_phone
  ON public.conversations (customer_id, (COALESCE(metadata->>'phone_number_id', '')))
  WHERE status = 'active';
