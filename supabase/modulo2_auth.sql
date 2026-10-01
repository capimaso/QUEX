-- =====================================================
-- QUÉX - MÓDULO 2: AUTH (rode UMA vez no SQL Editor)
-- =====================================================
-- 1. Validação matemática de CPF/CNPJ dentro do banco
--    (segunda barreira, além do front e da API)
-- 2. Constraints NOT VALID: só valem pra linhas novas/editadas,
--    então contas antigas não quebram na hora
-- 3. Trigger: quando o e-mail é confirmado no Supabase Auth,
--    usuario.is_active vira true automaticamente
-- =====================================================

begin;

create or replace function public.quex_cpf_valido(p text)
returns boolean
language plpgsql
immutable
as $$
declare
  c text := regexp_replace(coalesce(p, ''), '\D', '', 'g');
  t int; i int; s int; d int;
begin
  if length(c) <> 11 or c ~ '^(\d)\1{10}$' then
    return false;
  end if;
  for t in 9..10 loop
    s := 0;
    for i in 1..t loop
      s := s + substr(c, i, 1)::int * (t + 2 - i);
    end loop;
    d := ((s * 10) % 11) % 10;
    if d <> substr(c, t + 1, 1)::int then
      return false;
    end if;
  end loop;
  return true;
end;
$$;

create or replace function public.quex_cnpj_valido(p text)
returns boolean
language plpgsql
immutable
as $$
declare
  c text := regexp_replace(coalesce(p, ''), '\D', '', 'g');
  w1 int[] := array[5,4,3,2,9,8,7,6,5,4,3,2];
  w2 int[] := array[6,5,4,3,2,9,8,7,6,5,4,3,2];
  s int; r int; d1 int; d2 int; i int;
begin
  if length(c) <> 14 or c ~ '^(\d)\1{13}$' then
    return false;
  end if;
  s := 0;
  for i in 1..12 loop s := s + substr(c, i, 1)::int * w1[i]; end loop;
  r := s % 11;
  d1 := case when r < 2 then 0 else 11 - r end;
  if d1 <> substr(c, 13, 1)::int then return false; end if;
  s := 0;
  for i in 1..13 loop s := s + substr(c, i, 1)::int * w2[i]; end loop;
  r := s % 11;
  d2 := case when r < 2 then 0 else 11 - r end;
  return d2 = substr(c, 14, 1)::int;
end;
$$;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'chk_comprador_cpf_valido') then
    alter table public.comprador
      add constraint chk_comprador_cpf_valido
      check (public.quex_cpf_valido(cpf)) not valid;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'chk_vendedor_documento_valido') then
    alter table public.vendedor
      add constraint chk_vendedor_documento_valido
      check (
        case length(regexp_replace(cpf_cnpj, '\D', '', 'g'))
          when 11 then public.quex_cpf_valido(cpf_cnpj)
          when 14 then public.quex_cnpj_valido(cpf_cnpj)
          else false
        end
      ) not valid;
  end if;
end $$;

-- E-mail confirmado no Supabase Auth => conta ativa no QUÉX
create or replace function public.quex_ativar_usuario_confirmado()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.email_confirmed_at is not null and old.email_confirmed_at is null then
    update public.usuario
       set is_active = true
     where auth_user_id = new.id
       and is_active = false;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_quex_ativar_usuario on auth.users;
create trigger trg_quex_ativar_usuario
  after update of email_confirmed_at on auth.users
  for each row execute function public.quex_ativar_usuario_confirmado();

commit;
