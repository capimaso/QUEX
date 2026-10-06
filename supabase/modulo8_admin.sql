-- ============================================================
-- QUÉX - MÓDULO 8
-- Painel Administrativo (ADM / CEO)
-- ============================================================
-- Execute UMA VEZ no Supabase:
-- SQL Editor -> New query -> cole tudo -> Run
--
-- IMPORTANTE:
-- usuario.tipo já é usado pelo QUÉX para "comprador"/"vendedor".
-- Por isso este módulo NÃO altera esse campo.
-- O nível administrativo fica em usuario.nivel_acesso:
--   comum | adm | ceo
-- ============================================================

begin;

-- ---------- acesso administrativo e banimento ----------
alter table public.usuario
  add column if not exists nivel_acesso varchar(10) not null default 'comum';

alter table public.usuario
  add column if not exists data_criacao timestamptz not null default now();

alter table public.usuario
  add column if not exists banido_em timestamptz null;

alter table public.usuario
  add column if not exists banido_por integer null;

alter table public.usuario
  add column if not exists motivo_banimento text null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'chk_usuario_nivel_acesso'
      and conrelid = 'public.usuario'::regclass
  ) then
    alter table public.usuario
      add constraint chk_usuario_nivel_acesso
      check (nivel_acesso in ('comum', 'adm', 'ceo'));
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'fk_usuario_banido_por'
      and conrelid = 'public.usuario'::regclass
  ) then
    alter table public.usuario
      add constraint fk_usuario_banido_por
      foreign key (banido_por)
      references public.usuario(id)
      on delete set null;
  end if;
end
$$;

create index if not exists ix_usuario_nivel_acesso
  on public.usuario(nivel_acesso);

create index if not exists ix_usuario_banido_em
  on public.usuario(banido_em);

-- ---------- status dos tickets ----------
-- Módulo 7 usava "em_atendimento" e "resolvido".
-- Módulo 8 padroniza a UI em: Aberto, Respondido, Fechado.
update public.ticket
set status = 'respondido'
where status = 'em_atendimento';

update public.ticket
set status = 'fechado'
where status = 'resolvido';

alter table public.ticket
  drop constraint if exists chk_ticket_status;

alter table public.ticket
  add constraint chk_ticket_status
  check (status in ('aberto', 'respondido', 'fechado'));

alter table public.ticket
  alter column status set default 'aberto';

-- ---------- auditoria das reivindicações de CPF ----------
alter table public.reivindicacao_cpf
  add column if not exists decisao_motivo text null;

alter table public.reivindicacao_cpf
  add column if not exists decidida_por integer null;

alter table public.reivindicacao_cpf
  add column if not exists data_decisao timestamptz null;

alter table public.reivindicacao_cpf
  add column if not exists usuario_transferido_id integer null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'fk_reivindicacao_decidida_por'
      and conrelid = 'public.reivindicacao_cpf'::regclass
  ) then
    alter table public.reivindicacao_cpf
      add constraint fk_reivindicacao_decidida_por
      foreign key (decidida_por)
      references public.usuario(id)
      on delete set null;
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'fk_reivindicacao_usuario_transferido'
      and conrelid = 'public.reivindicacao_cpf'::regclass
  ) then
    alter table public.reivindicacao_cpf
      add constraint fk_reivindicacao_usuario_transferido
      foreign key (usuario_transferido_id)
      references public.usuario(id)
      on delete set null;
  end if;
end
$$;

create index if not exists ix_reivindicacao_data_criacao
  on public.reivindicacao_cpf(data_criacao desc);

-- RLS continua habilitado. O navegador não recebe acesso direto.
alter table public.usuario enable row level security;
alter table public.ticket enable row level security;
alter table public.ticket_mensagem enable row level security;
alter table public.reivindicacao_cpf enable row level security;

commit;

-- ============================================================
-- COMO PROMOVER UMA CONTA EXISTENTE PARA CEO/ADM
-- ============================================================
-- 1) Crie a conta normalmente pelo QUÉX e confirme o e-mail.
-- 2) Troque SEU_EMAIL pelo e-mail real.
--
-- CEO:
-- update public.usuario
-- set nivel_acesso = 'ceo'
-- where lower(email) = lower('SEU_EMAIL');
--
-- ADM:
-- update public.usuario
-- set nivel_acesso = 'adm'
-- where lower(email) = lower('SEU_EMAIL');
--
-- Conferir:
-- select id, nome, email, tipo, nivel_acesso, is_active
-- from public.usuario
-- order by id;
