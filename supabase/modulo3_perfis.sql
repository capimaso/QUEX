-- =====================================================
-- QUÉX - MÓDULO 3: PERFIS (rode UMA vez no SQL Editor)
-- =====================================================
-- 1. Bucket "avatars" no Storage (público pra leitura, 2 MB, só imagem)
--    + policies: cada usuário só escreve na PRÓPRIA pasta (<auth uid>/arquivo)
-- 2. Limite de 500 caracteres na bio
-- 3. View perfil_publico: o que qualquer pessoa logada pode ver de um
--    perfil (nome, foto, bio, localização, nota). NUNCA e-mail/CPF/telefone.
-- =====================================================

begin;

-- 1. Storage ------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "quex_avatars_insert_own" on storage.objects;
create policy "quex_avatars_insert_own" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "quex_avatars_update_own" on storage.objects;
create policy "quex_avatars_update_own" on storage.objects
  for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "quex_avatars_delete_own" on storage.objects;
create policy "quex_avatars_delete_own" on storage.objects
  for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- 2. Bio ---------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'chk_usuario_bio') then
    alter table public.usuario
      add constraint chk_usuario_bio check (bio is null or char_length(bio) <= 500);
  end if;
end $$;

-- 3. Perfil público ----------------------------------------------------
create or replace view public.perfil_publico as
select
  u.id,
  u.tipo,
  u.nome,
  nullif(btrim(v.comercial), '') as comercial,
  coalesce(nullif(btrim(v.comercial), ''), u.nome) as nome_exibicao,
  u.bio,
  u.foto_perfil,
  coalesce(nullif(btrim(u.localizacao), ''), nullif(btrim(v.localizacao), '')) as localizacao,
  r.media,
  coalesce(r.total, 0) as total,
  -- colunas sem acento/maiúscula só pra busca ("palhoca" acha "Palhoça")
  lower(extensions.unaccent(concat_ws(' ', u.nome, v.comercial))) as nome_busca,
  lower(extensions.unaccent(coalesce(nullif(btrim(u.localizacao), ''), v.localizacao, ''))) as local_busca
from public.usuario u
left join public.vendedor v on v.id = u.id
left join public.avaliacao_resumo r on r.usuario_id = u.id
where u.is_active
  and u.tipo in ('comprador', 'vendedor');

-- Só a API (service role) lê; anon/authenticated não.
revoke all on public.perfil_publico from anon, authenticated;
grant select on public.perfil_publico to service_role;

commit;
