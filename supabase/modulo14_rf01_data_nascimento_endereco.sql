-- QUÉX RF01: data de nascimento e endereço detalhado.
-- Idempotente: preserva dados e nunca remove colunas ou tabelas.

begin;

alter table public.usuario
  add column if not exists data_nascimento date,
  add column if not exists rua varchar(180),
  add column if not exists bairro varchar(120);

-- Migra a data legada sem sobrescrever uma data já preenchida.
update public.usuario
   set data_nascimento = data_nasc
 where data_nascimento is null
   and data_nasc is not null;

-- O endereço completo pode exceder o limite legado de 255 caracteres.
alter table public.usuario
  alter column endereco type text
  using endereco::text;

alter table public.entrega
  alter column endereco_destino type text
  using endereco_destino::text;

-- Remove novos dados pessoais quando a rotina existente anonimiza a conta.
create or replace function public.quex_anonimizar_dados_rf01()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.excluido_em is not null then
    new.data_nascimento := null;
    new.data_nasc := null;
    new.rua := null;
    new.bairro := null;
  end if;

  return new;
end;
$$;

do $$
begin
  if not exists (
    select 1
      from pg_trigger
     where tgname = 'trg_usuario_anonimizar_dados_rf01'
       and tgrelid = 'public.usuario'::regclass
       and not tgisinternal
  ) then
    create trigger trg_usuario_anonimizar_dados_rf01
    before update on public.usuario
    for each row
    execute function public.quex_anonimizar_dados_rf01();
  end if;
end;
$$;

commit;
