-- =====================================================
-- QUÉX - MÓDULO 4: PRODUTOS (rode UMA vez no SQL Editor)
-- =====================================================
-- 1. Bucket "produtos" no Storage (público pra leitura, 3 MB, só imagem)
--    + policies: cada vendedor só mexe na PRÓPRIA pasta (<auth uid>/arquivo)
-- 2. Desativa na lista de espécies as que o QUÉX proíbe vender
--    (a lista inicial do módulo 1 trazia "Garoupa", que é protegida)
-- =====================================================

begin;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('produtos', 'produtos', true, 3145728, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "quex_produtos_insert_own" on storage.objects;
create policy "quex_produtos_insert_own" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'produtos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "quex_produtos_select_own" on storage.objects;
create policy "quex_produtos_select_own" on storage.objects
  for select to authenticated
  using (bucket_id = 'produtos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "quex_produtos_update_own" on storage.objects;
create policy "quex_produtos_update_own" on storage.objects
  for update to authenticated
  using (bucket_id = 'produtos' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'produtos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "quex_produtos_delete_own" on storage.objects;
create policy "quex_produtos_delete_own" on storage.objects
  for delete to authenticated
  using (bucket_id = 'produtos' and (storage.foldername(name))[1] = auth.uid()::text);

-- Espécies proibidas (mesma lista validada na API: api/_lib/species.js)
update public.especie
   set ativo = false
 where regexp_replace(lower(extensions.unaccent(nome)), '[-_\s]+', ' ', 'g') ~
       '(^| )(garoupa|mero|cacao anjo|tubarao martelo|peixe serra|peixe boi|tartaruga marinha|cavalo marinho)( |$)';

commit;
