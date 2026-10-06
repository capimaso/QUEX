-- ============================================================
-- QUÉX - MÓDULO 7
-- Suporte, tickets e reivindicação de CPF
-- ============================================================
-- Execute este arquivo UMA VEZ no Supabase:
-- SQL Editor -> New query -> cole o conteúdo -> Run
--
-- O navegador não acessa estas tabelas diretamente.
-- As operações passam por /api/support usando SERVICE ROLE.
-- ============================================================

begin;

create sequence if not exists public.ticket_numero_seq
  start with 1
  increment by 1
  minvalue 1;

create table if not exists public.ticket (
  id bigserial primary key,
  numero bigint not null unique default nextval('public.ticket_numero_seq'),
  usuario_id integer null,
  motivo varchar(40) not null,
  mensagem text not null,
  status varchar(30) not null default 'aberto',
  data_criacao timestamptz not null default now(),
  data_atualizacao timestamptz not null default now(),

  constraint fk_ticket_usuario
    foreign key (usuario_id)
    references public.usuario(id)
    on delete set null,

  constraint chk_ticket_motivo
    check (
      motivo in (
        'problema_pedido',
        'problema_pagamento',
        'problema_vendedor',
        'problema_comprador',
        'duvida_geral',
        'outros',
        'reivindicacao_cpf'
      )
    ),

  constraint chk_ticket_status
    check (
      status in (
        'aberto',
        'em_atendimento',
        'resolvido',
        'fechado'
      )
    ),

  constraint chk_ticket_mensagem
    check (
      char_length(btrim(mensagem)) between 1 and 2000
    )
);

alter sequence public.ticket_numero_seq
  owned by public.ticket.numero;

create table if not exists public.ticket_mensagem (
  id bigserial primary key,
  ticket_id bigint not null,
  autor_id integer null,
  mensagem text not null,
  data_envio timestamptz not null default now(),
  is_adm boolean not null default false,

  constraint fk_ticket_mensagem_ticket
    foreign key (ticket_id)
    references public.ticket(id)
    on delete cascade,

  constraint fk_ticket_mensagem_autor
    foreign key (autor_id)
    references public.usuario(id)
    on delete set null,

  constraint chk_ticket_mensagem_texto
    check (
      char_length(btrim(mensagem)) between 1 and 2000
    )
);

create table if not exists public.reivindicacao_cpf (
  id bigserial primary key,
  cpf varchar(11) not null,
  email varchar(150) not null,
  telefone varchar(30) not null,
  motivo text not null,
  status varchar(30) not null default 'aberta',
  data_criacao timestamptz not null default now(),

  constraint chk_reivindicacao_cpf_formato
    check (cpf ~ '^[0-9]{11}$'),

  constraint chk_reivindicacao_cpf_status
    check (
      status in (
        'aberta',
        'em_analise',
        'aprovada',
        'recusada'
      )
    ),

  constraint chk_reivindicacao_cpf_motivo
    check (
      char_length(btrim(motivo)) between 10 and 1000
    )
);

create index if not exists ix_ticket_usuario
  on public.ticket(usuario_id);

create index if not exists ix_ticket_status
  on public.ticket(status);

create index if not exists ix_ticket_data_criacao
  on public.ticket(data_criacao desc);

create index if not exists ix_ticket_mensagem_ticket
  on public.ticket_mensagem(ticket_id);

create index if not exists ix_reivindicacao_cpf_status
  on public.reivindicacao_cpf(status);

create index if not exists ix_reivindicacao_cpf_cpf
  on public.reivindicacao_cpf(cpf);

create or replace function public.quex_touch_ticket_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.data_atualizacao = now();
  return new;
end;
$$;

drop trigger if exists trg_quex_ticket_updated_at
  on public.ticket;

create trigger trg_quex_ticket_updated_at
before update on public.ticket
for each row
execute function public.quex_touch_ticket_updated_at();

create or replace function public.quex_touch_ticket_on_message()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  update public.ticket
  set data_atualizacao = now()
  where id = new.ticket_id;

  return new;
end;
$$;

drop trigger if exists trg_quex_ticket_message_touch
  on public.ticket_mensagem;

create trigger trg_quex_ticket_message_touch
after insert on public.ticket_mensagem
for each row
execute function public.quex_touch_ticket_on_message();

-- RLS ligado e sem políticas para anon/authenticated.
-- A service_role usada pela API continua podendo operar.
alter table public.ticket enable row level security;
alter table public.ticket_mensagem enable row level security;
alter table public.reivindicacao_cpf enable row level security;

revoke all on table public.ticket from anon, authenticated;
revoke all on table public.ticket_mensagem from anon, authenticated;
revoke all on table public.reivindicacao_cpf from anon, authenticated;
revoke all on sequence public.ticket_numero_seq from anon, authenticated;

grant all on table public.ticket to service_role;
grant all on table public.ticket_mensagem to service_role;
grant all on table public.reivindicacao_cpf to service_role;

grant usage, select on sequence public.ticket_numero_seq to service_role;
grant usage, select on sequence public.ticket_id_seq to service_role;
grant usage, select on sequence public.ticket_mensagem_id_seq to service_role;
grant usage, select on sequence public.reivindicacao_cpf_id_seq to service_role;

commit;
