-- =====================================================
-- QUÉX - MÓDULO 5: AVALIAÇÕES (rode UMA vez no SQL Editor)
-- =====================================================
-- A tabela `avaliacao`, as regras (só pedido ENTREGUE, só comprador<->vendedor
-- do pedido, 1 por pessoa por pedido) e a view `avaliacao_resumo` já vieram
-- do módulo 1. Aqui só endurecemos:
--   * comentário com no máximo 500 caracteres
--   * avaliação imutável (não dá pra trocar nota/autor/pedido depois de enviada)
--   * índice pra achar "o que eu já avaliei" rápido
-- É idempotente.
-- =====================================================

begin;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'chk_avaliacao_comentario') then
    alter table public.avaliacao
      add constraint chk_avaliacao_comentario
      check (comentario is null or char_length(comentario) <= 500);
  end if;
end $$;

create index if not exists ix_avaliacao_avaliador_pedido
  on public.avaliacao (avaliador_id, pedido_id);

create or replace function public.quex_avaliacao_imutavel()
returns trigger
language plpgsql
as $$
begin
  if new.pedido_id is distinct from old.pedido_id
     or new.avaliador_id is distinct from old.avaliador_id
     or new.avaliado_id is distinct from old.avaliado_id
     or new.nota is distinct from old.nota then
    raise exception 'Avaliação enviada não pode ser alterada.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_avaliacao_imutavel on public.avaliacao;
create trigger trg_avaliacao_imutavel
  before update on public.avaliacao
  for each row execute function public.quex_avaliacao_imutavel();

commit;
