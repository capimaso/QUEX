-- =====================================================
-- QUÉX - MÓDULO 1: BANCO (migration complementar)
-- =====================================================
-- Rode UMA vez no SQL Editor do Supabase. É idempotente
-- (pode rodar de novo sem quebrar) e NÃO apaga nada.
--
-- O que faz:
--   1. usuario: auth_user_id, is_active, bio, foto_perfil,
--      localizacao, created_at, updated_at
--   2. especie (lista controlada) + produto.especie_id
--      (com sincronização com a coluna antiga produto.especie)
--   3. avaliacao (anônima, com regras no próprio banco)
--   4. denuncia
--   5. view avaliacao_resumo (média/quantidade/distribuição)
--   6. RLS ligado nas tabelas novas + índices
--
-- Usuários que já existem continuam ativos (is_active = true),
-- então ninguém é bloqueado pelo deploy desta migration.
-- =====================================================

begin;

create extension if not exists unaccent with schema extensions;

-- -----------------------------------------------------
-- Função genérica de updated_at
-- -----------------------------------------------------
create or replace function public.quex_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- -----------------------------------------------------
-- 1. USUARIO
-- -----------------------------------------------------
alter table public.usuario
  add column if not exists auth_user_id uuid,
  add column if not exists is_active boolean not null default true,
  add column if not exists bio text,
  add column if not exists foto_perfil text,
  add column if not exists localizacao varchar(255),
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

create unique index if not exists ux_usuario_auth_user_id
  on public.usuario (auth_user_id)
  where auth_user_id is not null;

-- Traz a localização que já existia nos vendedores
update public.usuario u
   set localizacao = v.localizacao
  from public.vendedor v
 where v.id = u.id
   and coalesce(btrim(u.localizacao), '') = ''
   and coalesce(btrim(v.localizacao), '') <> '';

drop trigger if exists trg_usuario_updated_at on public.usuario;
create trigger trg_usuario_updated_at
  before update on public.usuario
  for each row execute function public.quex_set_updated_at();

-- -----------------------------------------------------
-- 2. ESPECIE + produto.especie_id
-- -----------------------------------------------------
create table if not exists public.especie (
  id serial primary key,
  nome varchar(100) not null,
  ativo boolean not null default true,
  constraint uq_especie_nome unique (nome)
);

-- Impede "Tilápia", "tilapia", "TILÁPIA" como espécies diferentes
create unique index if not exists ux_especie_nome_normalizado
  on public.especie (lower(btrim(nome)));

insert into public.especie (nome) values
  ('Tilápia'), ('Tainha'), ('Robalo'), ('Sardinha'), ('Anchova'),
  ('Pescada'), ('Corvina'), ('Linguado'), ('Cavala'), ('Atum'),
  ('Badejo'), ('Garoupa'), ('Namorado'), ('Parati'), ('Betara'),
  ('Savelha'), ('Tambaqui'), ('Pintado'), ('Dourado'), ('Pacu'),
  ('Carpa'), ('Traíra'), ('Bagre'), ('Camarão'), ('Siri'),
  ('Caranguejo'), ('Lagosta'), ('Lula'), ('Polvo'), ('Ostra'),
  ('Mexilhão'), ('Berbigão'), ('Vieira')
on conflict do nothing;

alter table public.produto
  add column if not exists especie_id integer;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'fk_produto_especie'
  ) then
    alter table public.produto
      add constraint fk_produto_especie
      foreign key (especie_id) references public.especie(id) on delete set null;
  end if;
end $$;

-- Espécies que já existiam como texto livre viram registros da lista
insert into public.especie (nome)
select distinct on (lower(extensions.unaccent(btrim(p.especie))))
       initcap(btrim(p.especie))
  from public.produto p
 where btrim(coalesce(p.especie, '')) <> ''
   and not exists (
     select 1 from public.especie e
      where lower(extensions.unaccent(e.nome)) = lower(extensions.unaccent(btrim(p.especie)))
   )
 order by lower(extensions.unaccent(btrim(p.especie)))
on conflict do nothing;

-- Liga os produtos existentes à espécie correspondente
update public.produto p
   set especie_id = e.id
  from public.especie e
 where p.especie_id is null
   and btrim(coalesce(p.especie, '')) <> ''
   and lower(extensions.unaccent(e.nome)) = lower(extensions.unaccent(btrim(p.especie)));

-- Padroniza o texto antigo ("tilapia" -> "Tilápia")
update public.produto p
   set especie = e.nome
  from public.especie e
 where p.especie_id = e.id
   and p.especie is distinct from e.nome;

-- Mantém produto.especie (texto) e produto.especie_id em sincronia.
-- Assim a API atual (que ainda grava texto) continua funcionando
-- até o módulo de produtos migrar pro especie_id.
create or replace function public.quex_sync_produto_especie()
returns trigger
language plpgsql
as $$
declare
  v_id integer;
  v_nome varchar;
begin
  if tg_op = 'INSERT' then
    if new.especie_id is not null then
      select nome into v_nome from public.especie where id = new.especie_id;
      new.especie := v_nome;
    elsif btrim(coalesce(new.especie, '')) <> '' then
      select id into v_id from public.especie
       where lower(extensions.unaccent(nome)) = lower(extensions.unaccent(btrim(new.especie)))
       limit 1;
      new.especie_id := v_id;
    end if;
  else
    if new.especie_id is distinct from old.especie_id then
      select nome into v_nome from public.especie where id = new.especie_id;
      new.especie := v_nome;
    elsif new.especie is distinct from old.especie then
      select id into v_id from public.especie
       where lower(extensions.unaccent(nome)) = lower(extensions.unaccent(btrim(coalesce(new.especie, ''))))
       limit 1;
      new.especie_id := v_id;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_produto_sync_especie on public.produto;
create trigger trg_produto_sync_especie
  before insert or update on public.produto
  for each row execute function public.quex_sync_produto_especie();

-- -----------------------------------------------------
-- 3. AVALIACAO
-- -----------------------------------------------------
-- Regra: só pedido ENTREGUE, só entre comprador e vendedor
-- daquele pedido, uma avaliação por pessoa por pedido.
create table if not exists public.avaliacao (
  id serial primary key,
  pedido_id integer not null,
  avaliador_id integer not null,
  avaliado_id integer not null,
  nota smallint not null,
  comentario text,
  data_criacao timestamptz not null default now(),
  constraint fk_avaliacao_pedido foreign key (pedido_id) references public.pedido(id) on delete cascade,
  constraint fk_avaliacao_avaliador foreign key (avaliador_id) references public.usuario(id) on delete cascade,
  constraint fk_avaliacao_avaliado foreign key (avaliado_id) references public.usuario(id) on delete cascade,
  constraint chk_avaliacao_nota check (nota between 1 and 5),
  constraint chk_avaliacao_partes check (avaliador_id <> avaliado_id),
  constraint uq_avaliacao_pedido_avaliador unique (pedido_id, avaliador_id)
);

create index if not exists ix_avaliacao_avaliado on public.avaliacao (avaliado_id);

create or replace function public.quex_validar_avaliacao()
returns trigger
language plpgsql
as $$
declare
  v_comprador integer;
  v_vendedor integer;
  v_status text;
begin
  select p.comprador_id, p.status, e.vendedor_id
    into v_comprador, v_status, v_vendedor
    from public.pedido p
    join public.entrega e on e.pedido_id = p.id
   where p.id = new.pedido_id;

  if not found then
    raise exception 'Pedido não encontrado ou sem entrega vinculada.';
  end if;

  if v_status <> 'entregue' then
    raise exception 'Só é possível avaliar pedidos entregues.';
  end if;

  if not (
    (new.avaliador_id = v_comprador and new.avaliado_id = v_vendedor) or
    (new.avaliador_id = v_vendedor and new.avaliado_id = v_comprador)
  ) then
    raise exception 'Avaliador e avaliado precisam ser as partes deste pedido.';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_avaliacao_validar on public.avaliacao;
create trigger trg_avaliacao_validar
  before insert on public.avaliacao
  for each row execute function public.quex_validar_avaliacao();

-- Resumo público: NUNCA expõe avaliador_id nem comentário
create or replace view public.avaliacao_resumo as
select
  avaliado_id as usuario_id,
  count(*)::integer as total,
  round(avg(nota)::numeric, 2) as media,
  count(*) filter (where nota = 1)::integer as nota_1,
  count(*) filter (where nota = 2)::integer as nota_2,
  count(*) filter (where nota = 3)::integer as nota_3,
  count(*) filter (where nota = 4)::integer as nota_4,
  count(*) filter (where nota = 5)::integer as nota_5
from public.avaliacao
group by avaliado_id;

-- -----------------------------------------------------
-- 4. DENUNCIA
-- -----------------------------------------------------
create table if not exists public.denuncia (
  id serial primary key,
  denunciante_id integer,
  usuario_denunciado_id integer,
  produto_id integer,
  categoria varchar(30) not null,
  descricao text,
  status varchar(20) not null default 'aberta',
  email_enviado_em timestamptz,
  data_criacao timestamptz not null default now(),
  constraint fk_denuncia_denunciante foreign key (denunciante_id) references public.usuario(id) on delete set null,
  constraint fk_denuncia_denunciado foreign key (usuario_denunciado_id) references public.usuario(id) on delete set null,
  constraint fk_denuncia_produto foreign key (produto_id) references public.produto(id) on delete set null,
  constraint chk_denuncia_categoria check (categoria in (
    'anuncio_enganoso', 'perfil_improprio', 'preco_abusivo_fraude', 'conteudo_ofensivo', 'outros'
  )),
  constraint chk_denuncia_status check (status in ('aberta', 'em_analise', 'resolvida', 'descartada')),
  constraint chk_denuncia_alvo check (usuario_denunciado_id is not null or produto_id is not null),
  constraint chk_denuncia_autodenuncia check (denunciante_id is distinct from usuario_denunciado_id),
  constraint chk_denuncia_outros check (categoria <> 'outros' or length(btrim(coalesce(descricao, ''))) >= 5)
);

create index if not exists ix_denuncia_status on public.denuncia (status);
create index if not exists ix_denuncia_produto on public.denuncia (produto_id);
create index if not exists ix_denuncia_denunciado on public.denuncia (usuario_denunciado_id);

-- -----------------------------------------------------
-- 5. SEGURANÇA (mesmo padrão do hardening.sql)
-- -----------------------------------------------------
-- Tudo passa pelas funções serverless (service role).
-- RLS ligado sem policies = anon/authenticated não leem nada.
alter table public.especie enable row level security;
alter table public.avaliacao enable row level security;
alter table public.denuncia enable row level security;

revoke all on public.especie from anon, authenticated;
revoke all on public.avaliacao from anon, authenticated;
revoke all on public.denuncia from anon, authenticated;
revoke all on public.avaliacao_resumo from anon, authenticated;

grant all on public.especie, public.avaliacao, public.denuncia to service_role;
grant select on public.avaliacao_resumo to service_role;
grant usage, select on all sequences in schema public to service_role;

-- Índices extras que vão ser úteis nos próximos módulos
create index if not exists ix_produto_especie on public.produto (especie_id);
create index if not exists ix_usuario_nome on public.usuario (lower(nome));

commit;
