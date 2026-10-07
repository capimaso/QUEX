-- ============================================================
-- QUÉX - MÓDULO 13
-- Correções finais, notificações, retenção e exclusão de conta
-- ============================================================
-- Idempotente, preserva tabelas e histórico financeiro.
-- ============================================================

begin;

-- ------------------------------------------------------------
-- 1. DOCUMENTO / IDENTIDADE
-- ------------------------------------------------------------

alter table public.usuario
  add column if not exists razao_social varchar(255),
  add column if not exists nome_imutavel boolean not null default false,
  add column if not exists verificacao_pendente boolean not null default false,
  add column if not exists ultimo_login_notificado_em timestamptz,
  add column if not exists excluido_em timestamptz,
  add column if not exists excluido_por integer;

do $$
begin
  if not exists (
    select 1
      from pg_constraint
     where conname = 'fk_usuario_excluido_por_mod13'
       and conrelid = 'public.usuario'::regclass
  ) then
    alter table public.usuario
      add constraint fk_usuario_excluido_por_mod13
      foreign key (excluido_por)
      references public.usuario(id);
  end if;
end
$$;


-- Contas CPF já existentes também ficam com documento/nome bloqueados.
-- Como não foram verificadas pela integração nova, ficam marcadas como pendentes.
update public.usuario u
   set nome_imutavel = true,
       verificacao_pendente = true
 where u.excluido_em is null
   and (
     exists (
       select 1
         from public.comprador c
        where c.id = u.id
          and char_length(regexp_replace(coalesce(c.cpf,''),'\D','','g')) = 11
     )
     or exists (
       select 1
         from public.vendedor v
        where v.id = u.id
          and char_length(regexp_replace(coalesce(v.cpf_cnpj,''),'\D','','g')) = 11
     )
   );

-- CNPJ antigo mantém nome fantasia editável e é marcado como pendente
-- até existir uma validação posterior.
update public.usuario u
   set nome_imutavel = false,
       verificacao_pendente = true
 where u.excluido_em is null
   and exists (
     select 1
       from public.vendedor v
      where v.id = u.id
        and char_length(regexp_replace(coalesce(v.cpf_cnpj,''),'\D','','g')) = 14
   );


-- ------------------------------------------------------------
-- 2. RETENÇÃO DE ANÚNCIOS
-- ------------------------------------------------------------

alter table public.produto
  add column if not exists retido boolean not null default false,
  add column if not exists motivo_retencao text,
  add column if not exists retido_em timestamptz,
  add column if not exists retido_por integer;

do $$
begin
  if not exists (
    select 1
      from pg_constraint
     where conname = 'fk_produto_retido_por_mod13'
       and conrelid = 'public.produto'::regclass
  ) then
    alter table public.produto
      add constraint fk_produto_retido_por_mod13
      foreign key (retido_por)
      references public.usuario(id);
  end if;
end
$$;

create index if not exists ix_produto_retido_mod13
  on public.produto (retido, ativo);

-- ------------------------------------------------------------
-- 3. NOTIFICAÇÕES
-- ------------------------------------------------------------

create table if not exists public.notificacao (
  id serial primary key,
  usuario_id integer not null,
  tipo varchar(40) not null,
  titulo varchar(180) not null,
  mensagem text not null,
  link varchar(500),
  lida boolean not null default false,
  data_criacao timestamptz not null default now(),
  constraint fk_notificacao_usuario_mod13
    foreign key (usuario_id)
    references public.usuario(id)
    on delete cascade,
  constraint chk_notificacao_tipo_mod13
    check (
      tipo in (
        'nova_venda',
        'nova_mensagem_qa',
        'nova_mensagem_chat',
        'nova_mensagem_suporte',
        'anuncio_retido',
        'pedido_atualizado',
        'novo_login'
      )
    )
);

create index if not exists ix_notificacao_usuario_lida_mod13
  on public.notificacao (usuario_id, lida, data_criacao desc);

alter table public.notificacao enable row level security;

revoke insert, update, delete on public.notificacao
  from anon, authenticated;

grant select on public.notificacao
  to authenticated;

grant all on public.notificacao
  to service_role;

grant usage, select on sequence public.notificacao_id_seq
  to service_role;

do $$
begin
  if not exists (
    select 1 from pg_policies
     where schemaname='public'
       and tablename='notificacao'
       and policyname='notificacao_owner_select_mod13'
  ) then
    execute $policy$
      create policy notificacao_owner_select_mod13
      on public.notificacao
      for select
      to authenticated
      using (
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
end
$$;

create or replace function public.quex_notificar_mod13(
  p_usuario_id integer,
  p_tipo varchar,
  p_titulo varchar,
  p_mensagem text,
  p_link varchar
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_usuario_id is null then
    return;
  end if;

  if not exists (
    select 1
      from public.usuario u
     where u.id = p_usuario_id
       and u.is_active = true
       and u.banido_em is null
       and u.excluido_em is null
  ) then
    return;
  end if;

  insert into public.notificacao (
    usuario_id,
    tipo,
    titulo,
    mensagem,
    link
  )
  values (
    p_usuario_id,
    p_tipo,
    left(coalesce(p_titulo,''),180),
    coalesce(p_mensagem,''),
    left(coalesce(p_link,''),500)
  );
exception
  when others then
    raise warning 'Falha ao criar notificação QUÉX: %', sqlerrm;
end;
$$;

revoke execute
  on function public.quex_notificar_mod13(integer,varchar,varchar,text,varchar)
  from public, anon, authenticated;

grant execute
  on function public.quex_notificar_mod13(integer,varchar,varchar,text,varchar)
  to service_role;

-- ------------------------------------------------------------
-- 4. TRIGGERS DE NOTIFICAÇÃO
-- ------------------------------------------------------------

create or replace function public.quex_notif_nova_venda_mod13()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.quex_notificar_mod13(
    new.vendedor_id,
    'nova_venda',
    'Nova venda',
    'Você recebeu um novo pedido #' || new.pedido_id || '.',
    '/seller/dashboard'
  );

  return new;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_trigger
     where tgname='trg_quex_notif_nova_venda_mod13'
       and tgrelid='public.entrega'::regclass
       and not tgisinternal
  ) then
    execute '
      create trigger trg_quex_notif_nova_venda_mod13
      after insert on public.entrega
      for each row
      execute function public.quex_notif_nova_venda_mod13()
    ';
  end if;
end
$$;

create or replace function public.quex_notif_status_pedido_mod13()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_comprador integer;
  v_label text;
begin
  if old.status is not distinct from new.status then
    return new;
  end if;

  select comprador_id
    into v_comprador
    from public.pedido
   where id = new.pedido_id;

  v_label :=
    case new.status
      when 'aguardando_pagamento' then 'Aguardando Pagamento'
      when 'em_preparo' then 'Em Preparo'
      when 'enviado' then 'Enviado'
      when 'despachado' then 'Enviado'
      when 'entregue' then 'Entregue'
      when 'cancelado' then 'Cancelado'
      else initcap(replace(new.status,'_',' '))
    end;

  perform public.quex_notificar_mod13(
    v_comprador,
    'pedido_atualizado',
    'Pedido atualizado',
    'O pedido #' || new.pedido_id || ' agora está: ' || v_label || '.',
    '/orders/' || new.pedido_id
  );

  return new;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_trigger
     where tgname='trg_quex_notif_status_pedido_mod13'
       and tgrelid='public.entrega'::regclass
       and not tgisinternal
  ) then
    execute '
      create trigger trg_quex_notif_status_pedido_mod13
      after update of status on public.entrega
      for each row
      execute function public.quex_notif_status_pedido_mod13()
    ';
  end if;
end
$$;

create or replace function public.quex_notif_pergunta_mod13()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_vendedor integer;
begin
  if coalesce(new.bloqueada,false) = true
     or coalesce(new.status,'ativa') <> 'ativa' then
    return new;
  end if;

  select vendedor_id
    into v_vendedor
    from public.produto
   where id = new.produto_id;

  perform public.quex_notificar_mod13(
    v_vendedor,
    'nova_mensagem_qa',
    'Nova pergunta no anúncio',
    'Alguém fez uma pergunta em um dos seus anúncios.',
    '/product/' || new.produto_id
  );

  return new;
end;
$$;

do $$
begin
  if to_regclass('public.pergunta_produto') is not null
     and not exists (
       select 1 from pg_trigger
        where tgname='trg_quex_notif_pergunta_mod13'
          and tgrelid='public.pergunta_produto'::regclass
          and not tgisinternal
     ) then
    execute '
      create trigger trg_quex_notif_pergunta_mod13
      after insert on public.pergunta_produto
      for each row
      execute function public.quex_notif_pergunta_mod13()
    ';
  end if;
end
$$;

create or replace function public.quex_notif_chat_mod13()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_chat record;
  v_destino integer;
begin
  if coalesce(new.bloqueada,false) = true
     or new.removida_em is not null then
    return new;
  end if;

  select *
    into v_chat
    from public.chat
   where id = new.chat_id;

  if not found then
    return new;
  end if;

  if new.remetente_id = v_chat.comprador_id then
    v_destino := v_chat.vendedor_id;
  else
    v_destino := v_chat.comprador_id;
  end if;

  perform public.quex_notificar_mod13(
    v_destino,
    'nova_mensagem_chat',
    'Nova mensagem',
    'Você recebeu uma nova mensagem sobre o pedido #' || v_chat.pedido_id || '.',
    '/chat/' || new.chat_id
  );

  return new;
end;
$$;

do $$
begin
  if to_regclass('public.mensagem_chat') is not null
     and not exists (
       select 1 from pg_trigger
        where tgname='trg_quex_notif_chat_mod13'
          and tgrelid='public.mensagem_chat'::regclass
          and not tgisinternal
     ) then
    execute '
      create trigger trg_quex_notif_chat_mod13
      after insert on public.mensagem_chat
      for each row
      execute function public.quex_notif_chat_mod13()
    ';
  end if;
end
$$;

create or replace function public.quex_notif_suporte_mod13()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ticket record;
  v_admin record;
begin
  if coalesce(new.bloqueada,false) = true then
    return new;
  end if;

  select *
    into v_ticket
    from public.ticket
   where id = new.ticket_id;

  if not found then
    return new;
  end if;

  if coalesce(new.is_adm,false) = true then
    perform public.quex_notificar_mod13(
      v_ticket.usuario_id,
      'nova_mensagem_suporte',
      'Nova resposta do suporte',
      'O suporte respondeu ao ticket #' || v_ticket.numero || '.',
      '/settings'
    );
  else
    for v_admin in
      select id
        from public.usuario
       where nivel_acesso in ('adm','ceo')
         and is_active = true
         and banido_em is null
         and excluido_em is null
    loop
      perform public.quex_notificar_mod13(
        v_admin.id,
        'nova_mensagem_suporte',
        'Novo atendimento',
        'Há uma nova mensagem no ticket #' || v_ticket.numero || '.',
        '/admin'
      );
    end loop;
  end if;

  return new;
end;
$$;

do $$
begin
  if to_regclass('public.ticket_mensagem') is not null
     and not exists (
       select 1 from pg_trigger
        where tgname='trg_quex_notif_suporte_mod13'
          and tgrelid='public.ticket_mensagem'::regclass
          and not tgisinternal
     ) then
    execute '
      create trigger trg_quex_notif_suporte_mod13
      after insert on public.ticket_mensagem
      for each row
      execute function public.quex_notif_suporte_mod13()
    ';
  end if;
end
$$;

create or replace function public.quex_notif_retencao_mod13()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(old.retido,false) = false
     and coalesce(new.retido,false) = true then
    perform public.quex_notificar_mod13(
      new.vendedor_id,
      'anuncio_retido',
      'Anúncio retido',
      'Seu anúncio "' || coalesce(new.nome,'Produto') ||
        '" foi retido pela administração. Motivo: ' ||
        coalesce(new.motivo_retencao,'Não informado'),
      '/seller/products'
    );
  end if;

  return new;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_trigger
     where tgname='trg_quex_notif_retencao_mod13'
       and tgrelid='public.produto'::regclass
       and not tgisinternal
  ) then
    execute '
      create trigger trg_quex_notif_retencao_mod13
      after update of retido on public.produto
      for each row
      execute function public.quex_notif_retencao_mod13()
    ';
  end if;
end
$$;

-- Garante que anúncio retido não permaneça ativo.
create or replace function public.quex_forcar_produto_retido_inativo_mod13()
returns trigger
language plpgsql
as $$
begin
  if coalesce(new.retido,false) = true then
    new.ativo := false;
  end if;
  return new;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_trigger
     where tgname='trg_quex_forcar_produto_retido_inativo_mod13'
       and tgrelid='public.produto'::regclass
       and not tgisinternal
  ) then
    execute '
      create trigger trg_quex_forcar_produto_retido_inativo_mod13
      before insert or update of retido, ativo on public.produto
      for each row
      execute function public.quex_forcar_produto_retido_inativo_mod13()
    ';
  end if;
end
$$;

-- ------------------------------------------------------------
-- 5. ESCROW DE 24H
-- ------------------------------------------------------------

create table if not exists public.transacao_saldo (
  id serial primary key,
  vendedor_id integer not null,
  pedido_id integer not null,
  tipo varchar(40) not null default 'credito_venda',
  valor numeric(12,2) not null,
  status varchar(30) not null default 'escrow',
  disponivel_em timestamptz,
  data_criacao timestamptz not null default now()
);

alter table public.transacao_saldo
  add column if not exists vendedor_id integer,
  add column if not exists pedido_id integer,
  add column if not exists tipo varchar(40) default 'credito_venda',
  add column if not exists valor numeric(12,2),
  add column if not exists status varchar(30) default 'escrow',
  add column if not exists disponivel_em timestamptz,
  add column if not exists data_criacao timestamptz default now();

create index if not exists ix_transacao_saldo_vendedor_mod13
  on public.transacao_saldo (vendedor_id, status, disponivel_em);

create index if not exists ix_transacao_saldo_pedido_mod13
  on public.transacao_saldo (pedido_id, vendedor_id);

create or replace function public.quex_creditar_escrow_mod13()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_receita record;
  v_valor numeric(12,2);
begin
  if old.status is not distinct from new.status
     or new.status <> 'entregue' then
    return new;
  end if;

  perform pg_advisory_xact_lock(new.pedido_id, new.vendedor_id);

  if exists (
    select 1
      from public.transacao_saldo
     where pedido_id = new.pedido_id
       and vendedor_id = new.vendedor_id
       and tipo = 'credito_venda'
  ) then
    return new;
  end if;

  select *
    into v_receita
    from public.receita_plataforma
   where pedido_id = new.pedido_id
     and vendedor_id = new.vendedor_id
   limit 1;

  if not found then
    raise warning 'Receita não encontrada para pedido % vendedor %',
      new.pedido_id, new.vendedor_id;
    return new;
  end if;

  v_valor :=
    round(
      (
        coalesce(v_receita.valor_produto,0) -
        coalesce(v_receita.valor_taxa,0)
      )::numeric,
      2
    );

  if v_valor <= 0 then
    return new;
  end if;

  insert into public.transacao_saldo (
    vendedor_id,
    pedido_id,
    tipo,
    valor,
    status,
    disponivel_em,
    data_criacao
  )
  values (
    new.vendedor_id,
    new.pedido_id,
    'credito_venda',
    v_valor,
    'escrow',
    now() + interval '24 hours',
    now()
  );

  return new;
end;
$$;

do $$
begin
  -- Se um módulo anterior já instalou um trigger/função de escrow,
  -- não adicionamos um segundo crédito.
  if not exists (
    select 1
      from pg_trigger t
      join pg_proc p
        on p.oid = t.tgfoid
     where not t.tgisinternal
       and (
         pg_get_functiondef(p.oid) ilike '%transacao_saldo%'
         or pg_get_functiondef(p.oid) ilike '%escrow%'
       )
  )
  and not exists (
    select 1
      from pg_trigger
     where tgname='trg_quex_creditar_escrow_mod13'
       and tgrelid='public.entrega'::regclass
       and not tgisinternal
  ) then
    execute '
      create trigger trg_quex_creditar_escrow_mod13
      after update of status on public.entrega
      for each row
      execute function public.quex_creditar_escrow_mod13()
    ';
  end if;
end
$$;

-- ------------------------------------------------------------
-- 6. EXCLUSÃO / ANONIMIZAÇÃO DE CONTA
-- ------------------------------------------------------------

create or replace function public.quex_excluir_conta_mod13(
  p_usuario_id integer,
  p_actor_id integer,
  p_admin_mode boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_target record;
  v_actor record;
  v_target_level text;
  v_actor_level text;
  v_fake_doc text;
begin
  select *
    into v_target
    from public.usuario
   where id = p_usuario_id
   for update;

  if not found then
    raise exception 'Usuário não encontrado.';
  end if;

  select *
    into v_actor
    from public.usuario
   where id = p_actor_id;

  if not found then
    raise exception 'Usuário responsável não encontrado.';
  end if;

  v_target_level := lower(coalesce(v_target.nivel_acesso,'comum'));
  v_actor_level := lower(coalesce(v_actor.nivel_acesso,'comum'));

  if p_admin_mode then
    if v_actor_level not in ('adm','ceo') then
      raise exception 'Apenas ADM ou CEO pode excluir perfis.';
    end if;

    if p_usuario_id = p_actor_id then
      raise exception 'Use a exclusão da própria conta para excluir seu perfil.';
    end if;

    if v_actor_level = 'adm'
       and v_target_level in ('adm','ceo') then
      raise exception 'Um ADM não pode excluir outro ADM ou o CEO.';
    end if;

    if v_actor_level = 'ceo'
       and v_target_level = 'ceo' then
      raise exception 'Um CEO não pode excluir outro CEO por este fluxo.';
    end if;
  else
    if p_usuario_id <> p_actor_id then
      raise exception 'Você só pode excluir a própria conta.';
    end if;
  end if;

  -- Libera o CPF do comprador sem quebrar FKs financeiras.
  if exists (
    select 1 from public.comprador where id = p_usuario_id
  ) then
    update public.comprador
       set cpf = '9' || lpad(p_usuario_id::text, 10, '0')
     where id = p_usuario_id;
  end if;

  -- Libera CPF/CNPJ do vendedor preservando a linha para auditoria.
  if exists (
    select 1 from public.vendedor where id = p_usuario_id
  ) then
    select
      case
        when char_length(regexp_replace(coalesce(cpf_cnpj,''),'\D','','g')) = 14
          then '99' || lpad(p_usuario_id::text, 12, '0')
        else '9' || lpad(p_usuario_id::text, 10, '0')
      end
      into v_fake_doc
      from public.vendedor
     where id = p_usuario_id;

    update public.vendedor
       set cpf_cnpj = v_fake_doc,
           comercial = 'Conta excluída #' || p_usuario_id,
           localizacao = '',
           entrega_propria = false,
           entrega_disponivel = false,
           valor_por_km = null
     where id = p_usuario_id;
  end if;

  -- Produtos permanecem apenas como referência histórica.
  update public.produto
     set nome = 'Anúncio removido',
         descricao = null,
         fotos_url = '[]',
         ativo = false,
         retido = false,
         motivo_retencao = null,
         retido_em = null,
         retido_por = null
   where vendedor_id = p_usuario_id;

  -- Remove conteúdo pessoal de comunicações, mas preserva integridade referencial.
  if to_regclass('public.mensagem_chat') is not null then
    update public.mensagem_chat
       set mensagem = '[mensagem removida por exclusão de conta]',
           removida_em = coalesce(removida_em, now()),
           removida_por = p_actor_id
     where remetente_id = p_usuario_id;
  end if;

  if to_regclass('public.pergunta_produto') is not null then
    update public.pergunta_produto
       set pergunta = '[conteúdo removido por exclusão de conta]',
           status = 'removida'
     where usuario_id = p_usuario_id;
  end if;

  if to_regclass('public.resposta_produto') is not null then
    update public.resposta_produto
       set resposta = '[conteúdo removido por exclusão de conta]',
           removida_em = coalesce(removida_em, now()),
           removida_por = p_actor_id
     where vendedor_id = p_usuario_id;
  end if;

  if to_regclass('public.ticket') is not null then
    update public.ticket
       set usuario_id = null,
           mensagem = '[dados removidos por exclusão de conta]'
     where usuario_id = p_usuario_id;
  end if;

  if to_regclass('public.ticket_mensagem') is not null then
    update public.ticket_mensagem
       set mensagem = '[dados removidos por exclusão de conta]'
     where autor_id = p_usuario_id;
  end if;

  -- Pedidos e finanças são preservados, mas endereço do comprador é anonimizado.
  update public.entrega e
     set endereco_destino = 'Dados removidos por exclusão da conta'
   where exists (
     select 1
       from public.pedido p
      where p.id = e.pedido_id
        and p.comprador_id = p_usuario_id
   );

  delete from public.notificacao
   where usuario_id = p_usuario_id;

  update public.usuario
     set nome = 'Conta excluída #' || p_usuario_id,
         email = 'deleted+' || p_usuario_id || '@quex.invalid',
         senha = '!deleted',
         telefone = '00000000000',
         endereco = null,
         localizacao = null,
         cep = null,
         numero = null,
         complemento = null,
         cidade = null,
         uf = null,
         lat = null,
         lng = null,
         bio = null,
         foto_perfil = null,
         razao_social = null,
         nome_imutavel = false,
         verificacao_pendente = false,
         ultimo_login_notificado_em = null,
         auth_user_id = null,
         is_active = false,
         banido_em = null,
         banido_por = null,
         motivo_banimento = null,
         excluido_em = now(),
         excluido_por = p_actor_id
   where id = p_usuario_id;

  return jsonb_build_object(
    'ok', true,
    'usuario_id', p_usuario_id,
    'excluido_em', now()
  );
end;
$$;

revoke execute
  on function public.quex_excluir_conta_mod13(integer,integer,boolean)
  from public, anon, authenticated;

grant execute
  on function public.quex_excluir_conta_mod13(integer,integer,boolean)
  to service_role;

commit;

notify pgrst, 'reload schema';
