-- ============================================================
-- QUÉX - MÓDULO 12
-- Q&A público, chat privado, anti-contato e denúncia de mensagem
-- ============================================================
-- Migration compatível com o banco existente.
-- Não remove tabelas nem dados.
-- ============================================================

begin;

-- ------------------------------------------------------------
-- 1. PERGUNTAS PÚBLICAS
-- ------------------------------------------------------------

create table if not exists public.pergunta_produto (
  id serial primary key,
  produto_id integer not null,
  usuario_id integer not null,
  pergunta text not null,
  data_criacao timestamptz not null default now(),
  status varchar(20) not null default 'ativa',
  bloqueada boolean not null default false,
  motivo_bloqueio varchar(120),
  constraint fk_pergunta_produto_produto_mod12
    foreign key (produto_id)
    references public.produto(id)
    on delete cascade,
  constraint fk_pergunta_produto_usuario_mod12
    foreign key (usuario_id)
    references public.usuario(id),
  constraint chk_pergunta_produto_status_mod12
    check (status in ('ativa', 'removida', 'oculta')),
  constraint chk_pergunta_produto_texto_mod12
    check (
      char_length(btrim(pergunta)) between 1 and 500
    )
);

create table if not exists public.resposta_produto (
  id serial primary key,
  pergunta_id integer not null,
  vendedor_id integer not null,
  resposta text not null,
  data_criacao timestamptz not null default now(),
  bloqueada boolean not null default false,
  motivo_bloqueio varchar(120),
  removida_em timestamptz,
  removida_por integer,
  constraint fk_resposta_produto_pergunta_mod12
    foreign key (pergunta_id)
    references public.pergunta_produto(id)
    on delete cascade,
  constraint fk_resposta_produto_vendedor_mod12
    foreign key (vendedor_id)
    references public.vendedor(id),
  constraint fk_resposta_produto_removida_por_mod12
    foreign key (removida_por)
    references public.usuario(id),
  constraint chk_resposta_produto_texto_mod12
    check (
      char_length(btrim(resposta)) between 1 and 500
    )
);

-- Apenas UMA resposta oficial visível por pergunta.
-- Tentativas bloqueadas pelo anti-contato continuam registradas para auditoria,
-- mas não impedem o vendedor de corrigir e responder novamente.
create unique index if not exists ux_resposta_produto_oficial_mod12
  on public.resposta_produto (pergunta_id)
  where bloqueada = false
    and removida_em is null;

create index if not exists ix_pergunta_produto_produto_mod12
  on public.pergunta_produto (produto_id, data_criacao desc);

create index if not exists ix_pergunta_produto_usuario_mod12
  on public.pergunta_produto (usuario_id);

create index if not exists ix_resposta_produto_pergunta_mod12
  on public.resposta_produto (pergunta_id);

create index if not exists ix_resposta_produto_vendedor_mod12
  on public.resposta_produto (vendedor_id);

-- ------------------------------------------------------------
-- 2. CHAT PRIVADO ENTRE AS PARTES DO PEDIDO
-- ------------------------------------------------------------

create table if not exists public.chat (
  id serial primary key,
  comprador_id integer not null,
  vendedor_id integer not null,
  pedido_id integer not null,
  data_criacao timestamptz not null default now(),
  data_ultima_mensagem timestamptz,
  constraint fk_chat_comprador_mod12
    foreign key (comprador_id)
    references public.comprador(id),
  constraint fk_chat_vendedor_mod12
    foreign key (vendedor_id)
    references public.vendedor(id),
  constraint fk_chat_pedido_mod12
    foreign key (pedido_id)
    references public.pedido(id)
    on delete cascade,
  constraint uq_chat_partes_pedido_mod12
    unique (comprador_id, vendedor_id, pedido_id)
);

create table if not exists public.mensagem_chat (
  id serial primary key,
  chat_id integer not null,
  remetente_id integer not null,
  mensagem text not null,
  data_envio timestamptz not null default now(),
  lida boolean not null default false,
  bloqueada boolean not null default false,
  motivo_bloqueio varchar(120),
  removida_em timestamptz,
  removida_por integer,
  constraint fk_mensagem_chat_chat_mod12
    foreign key (chat_id)
    references public.chat(id)
    on delete cascade,
  constraint fk_mensagem_chat_remetente_mod12
    foreign key (remetente_id)
    references public.usuario(id),
  constraint fk_mensagem_chat_removida_por_mod12
    foreign key (removida_por)
    references public.usuario(id),
  constraint chk_mensagem_chat_texto_mod12
    check (
      char_length(btrim(mensagem)) between 1 and 2000
    )
);

create index if not exists ix_chat_comprador_mod12
  on public.chat (comprador_id, data_ultima_mensagem desc);

create index if not exists ix_chat_vendedor_mod12
  on public.chat (vendedor_id, data_ultima_mensagem desc);

create index if not exists ix_chat_pedido_mod12
  on public.chat (pedido_id);

create index if not exists ix_mensagem_chat_chat_mod12
  on public.mensagem_chat (chat_id, data_envio asc);

create index if not exists ix_mensagem_chat_remetente_mod12
  on public.mensagem_chat (remetente_id);

-- ------------------------------------------------------------
-- 3. ANTI-CONTATO NO CHAT DE SUPORTE
-- ------------------------------------------------------------

alter table public.ticket_mensagem
  add column if not exists bloqueada boolean not null default false,
  add column if not exists motivo_bloqueio varchar(120);

create index if not exists ix_ticket_mensagem_bloqueada_mod12
  on public.ticket_mensagem (ticket_id, bloqueada);

-- ------------------------------------------------------------
-- 4. DENÚNCIA DE MENSAGEM
-- ------------------------------------------------------------

alter table public.denuncia
  add column if not exists mensagem_id integer;

do $$
begin
  if not exists (
    select 1
      from pg_constraint
     where conname = 'fk_denuncia_mensagem_chat_mod12'
       and conrelid = 'public.denuncia'::regclass
  ) then
    alter table public.denuncia
      add constraint fk_denuncia_mensagem_chat_mod12
      foreign key (mensagem_id)
      references public.mensagem_chat(id)
      on delete set null;
  end if;
end
$$;

create index if not exists ix_denuncia_mensagem_mod12
  on public.denuncia (mensagem_id)
  where mensagem_id is not null;

-- ------------------------------------------------------------
-- 5. CHAT CRIADO AUTOMATICAMENTE APÓS CONFIRMAÇÃO DO PEDIDO
-- ------------------------------------------------------------

create or replace function public.quex_criar_chats_pedido_confirmado()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status in (
    'em_preparo',
    'enviado',
    'despachado',
    'entregue'
  ) then
    insert into public.chat (
      comprador_id,
      vendedor_id,
      pedido_id,
      data_criacao
    )
    select
      new.comprador_id,
      e.vendedor_id,
      new.id,
      coalesce(new.data_criacao, now())
    from public.entrega e
    where e.pedido_id = new.id
    on conflict (
      comprador_id,
      vendedor_id,
      pedido_id
    ) do nothing;
  end if;

  return new;
end;
$$;

do $$
begin
  if not exists (
    select 1
      from pg_trigger
     where tgname = 'trg_quex_criar_chats_pedido_confirmado'
       and tgrelid = 'public.pedido'::regclass
       and not tgisinternal
  ) then
    execute '
      create trigger trg_quex_criar_chats_pedido_confirmado
      after insert or update of status
      on public.pedido
      for each row
      execute function public.quex_criar_chats_pedido_confirmado()
    ';
  end if;
end
$$;

-- Backfill seguro para pedidos já confirmados antes da migration.
insert into public.chat (
  comprador_id,
  vendedor_id,
  pedido_id,
  data_criacao
)
select
  p.comprador_id,
  e.vendedor_id,
  p.id,
  coalesce(p.data_criacao, now())
from public.pedido p
join public.entrega e
  on e.pedido_id = p.id
where p.status in (
  'pago',
  'em_preparo',
  'enviado',
  'despachado',
  'entregue'
)
on conflict (
  comprador_id,
  vendedor_id,
  pedido_id
) do nothing;

-- Atualiza a ordenação do chat somente para mensagens realmente entregues.
create or replace function public.quex_atualizar_ultima_mensagem_chat()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.bloqueada = false
     and new.removida_em is null then
    update public.chat
       set data_ultima_mensagem = new.data_envio
     where id = new.chat_id;
  end if;

  return new;
end;
$$;

do $$
begin
  if not exists (
    select 1
      from pg_trigger
     where tgname = 'trg_quex_atualizar_ultima_mensagem_chat'
       and tgrelid = 'public.mensagem_chat'::regclass
       and not tgisinternal
  ) then
    execute '
      create trigger trg_quex_atualizar_ultima_mensagem_chat
      after insert
      on public.mensagem_chat
      for each row
      execute function public.quex_atualizar_ultima_mensagem_chat()
    ';
  end if;
end
$$;

-- ------------------------------------------------------------
-- 6. RLS - DEFESA EM PROFUNDIDADE
-- ------------------------------------------------------------

alter table public.pergunta_produto enable row level security;
alter table public.resposta_produto enable row level security;
alter table public.chat enable row level security;
alter table public.mensagem_chat enable row level security;

-- Policies criadas somente se ainda não existirem.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'pergunta_produto'
      and policyname = 'pergunta_publica_select_mod12'
  ) then
    execute $policy$
      create policy pergunta_publica_select_mod12
      on public.pergunta_produto
      for select
      to anon, authenticated
      using (
        status = 'ativa'
        and bloqueada = false
      )
    $policy$;
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'pergunta_produto'
      and policyname = 'pergunta_auth_insert_mod12'
  ) then
    execute $policy$
      create policy pergunta_auth_insert_mod12
      on public.pergunta_produto
      for insert
      to authenticated
      with check (
        exists (
          select 1
            from public.usuario u
           where u.id = usuario_id
             and u.auth_user_id = auth.uid()
             and u.is_active = true
             and u.banido_em is null
        )
      )
    $policy$;
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'resposta_produto'
      and policyname = 'resposta_publica_select_mod12'
  ) then
    execute $policy$
      create policy resposta_publica_select_mod12
      on public.resposta_produto
      for select
      to anon, authenticated
      using (
        bloqueada = false
        and removida_em is null
        and exists (
          select 1
            from public.pergunta_produto q
           where q.id = pergunta_id
             and q.status = 'ativa'
             and q.bloqueada = false
        )
      )
    $policy$;
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'resposta_produto'
      and policyname = 'resposta_vendedor_insert_mod12'
  ) then
    execute $policy$
      create policy resposta_vendedor_insert_mod12
      on public.resposta_produto
      for insert
      to authenticated
      with check (
        exists (
          select 1
            from public.usuario u
            join public.pergunta_produto q
              on q.id = pergunta_id
            join public.produto p
              on p.id = q.produto_id
           where u.id = vendedor_id
             and u.auth_user_id = auth.uid()
             and u.tipo = 'vendedor'
             and u.is_active = true
             and u.banido_em is null
             and p.vendedor_id = vendedor_id
        )
      )
    $policy$;
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'chat'
      and policyname = 'chat_participante_select_mod12'
  ) then
    execute $policy$
      create policy chat_participante_select_mod12
      on public.chat
      for select
      to authenticated
      using (
        exists (
          select 1
            from public.usuario u
           where u.auth_user_id = auth.uid()
             and u.is_active = true
             and u.banido_em is null
             and (
               u.id = comprador_id
               or u.id = vendedor_id
             )
        )
      )
    $policy$;
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'chat'
      and policyname = 'chat_participante_update_mod12'
  ) then
    execute $policy$
      create policy chat_participante_update_mod12
      on public.chat
      for update
      to authenticated
      using (
        exists (
          select 1
            from public.usuario u
           where u.auth_user_id = auth.uid()
             and (
               u.id = comprador_id
               or u.id = vendedor_id
             )
        )
      )
      with check (
        exists (
          select 1
            from public.usuario u
           where u.auth_user_id = auth.uid()
             and (
               u.id = comprador_id
               or u.id = vendedor_id
             )
        )
      )
    $policy$;
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'mensagem_chat'
      and policyname = 'mensagem_chat_participante_select_mod12'
  ) then
    execute $policy$
      create policy mensagem_chat_participante_select_mod12
      on public.mensagem_chat
      for select
      to authenticated
      using (
        exists (
          select 1
            from public.chat c
            join public.usuario u
              on u.auth_user_id = auth.uid()
           where c.id = chat_id
             and (
               u.id = c.comprador_id
               or u.id = c.vendedor_id
             )
        )
      )
    $policy$;
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'mensagem_chat'
      and policyname = 'mensagem_chat_participante_insert_mod12'
  ) then
    execute $policy$
      create policy mensagem_chat_participante_insert_mod12
      on public.mensagem_chat
      for insert
      to authenticated
      with check (
        exists (
          select 1
            from public.chat c
            join public.usuario u
              on u.auth_user_id = auth.uid()
           where c.id = chat_id
             and u.id = remetente_id
             and (
               u.id = c.comprador_id
               or u.id = c.vendedor_id
             )
        )
      )
    $policy$;
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'mensagem_chat'
      and policyname = 'mensagem_chat_participante_update_mod12'
  ) then
    execute $policy$
      create policy mensagem_chat_participante_update_mod12
      on public.mensagem_chat
      for update
      to authenticated
      using (
        exists (
          select 1
            from public.chat c
            join public.usuario u
              on u.auth_user_id = auth.uid()
           where c.id = chat_id
             and (
               u.id = c.comprador_id
               or u.id = c.vendedor_id
             )
        )
      )
      with check (
        exists (
          select 1
            from public.chat c
            join public.usuario u
              on u.auth_user_id = auth.uid()
           where c.id = chat_id
             and (
               u.id = c.comprador_id
               or u.id = c.vendedor_id
             )
        )
      )
    $policy$;
  end if;
end
$$;

-- Privilégios:
-- leitura direta respeita o RLS; TODA escrita continua passando pela API
-- com service_role para impedir que o anti-contato seja contornado.
grant select on public.pergunta_produto, public.resposta_produto
  to anon, authenticated;

grant select on public.chat, public.mensagem_chat
  to authenticated;

revoke insert, update, delete
  on public.pergunta_produto,
     public.resposta_produto,
     public.chat,
     public.mensagem_chat
  from anon, authenticated;

revoke usage
  on sequence public.pergunta_produto_id_seq,
     public.resposta_produto_id_seq,
     public.chat_id_seq,
     public.mensagem_chat_id_seq
  from anon, authenticated;

grant all on public.pergunta_produto,
  public.resposta_produto,
  public.chat,
  public.mensagem_chat
  to service_role;

grant usage, select on sequence public.pergunta_produto_id_seq,
  public.resposta_produto_id_seq,
  public.chat_id_seq,
  public.mensagem_chat_id_seq
  to service_role;

commit;

notify pgrst, 'reload schema';
