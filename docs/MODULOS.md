# QUÉX — plano em módulos

Cada módulo fecha sozinho (build passando) antes de começar o próximo.

- [x] **1. Banco** — `supabase/modulo1_migration.sql` (usuario+campos, especie, avaliacao, denuncia, resumo anônimo, RLS)
- [x] **2. Auth** — Supabase Auth como identidade (`usuario.auth_user_id`), CPF/CNPJ validado em front + API + banco, confirmação de e-mail (`is_active`), Google OAuth, `/complete-profile`, recuperação de senha, migração das contas antigas
- [x] **3. Perfis** — foto no Storage (`avatars`), bio, localização, perfil público (`/sellers/:id`, `/buyers/:id`), busca de vendedores (`/sellers`), view `perfil_publico`
- [x] **4. Produtos** — combobox de espécie (`especie_id`), upload múltiplo de fotos, trocar `fotos_url` de URL solta pra lista de arquivos
- [x] **5. Avaliações** — `POST /api/orders?resource=review`, estrelas + janela de avaliação nos pedidos (comprador→vendedor e vendedor→comprador), só pedido `entregue`, 1 por pessoa, anônimas, distribuição de notas no perfil
- [ ] **6. Denúncias** — modal, `/api/report`, e-mail via Resend
- [ ] **7. Layout** — header com 2 destinos + dropdown, configurações (dark mode, fonte, contraste), footer, FAQ flutuante
- [ ] **8. Visual e estabilidade** — parallax da Home, padding dos ícones nos inputs, animações padronizadas **e os 3 pedidos do Capi:**
  - [ ] **8a. Página em branco até dar F5.** Causas prováveis: não existe `ErrorBoundary` (qualquer erro de render vira tela branca); deploy novo da Vercel deixa o navegador com o `index.html` antigo apontando pra um `.js` que não existe mais; `getSession()` do Supabase travando. Plano: `ErrorBoundary` com botão "Recarregar"; recarregar sozinho 1x quando falhar o carregamento do JS (`vite:preloadError`); limite de tempo (~8s) no `AuthContext` pra nunca ficar carregando pra sempre.
  - [ ] **8b. Loading de peixinho.** Hoje é o `animate-spin` do Tailwind (1s, borda girando) copiado em ~14 lugares. Plano: um único componente `<Loading />` com peixe nadando em círculo devagar (~3s), respeitando `prefers-reduced-motion`. A arte fica em `public/assets/loading/` (`loading.svg`, com `loading.gif` de reserva): o time de design só troca o arquivo, sem mexer em código.
  - [ ] **8c. Busca sem acento/maiúscula ("file" achar "Filé").** Causa: o marketplace filtra com `toLowerCase().includes()` (em `api/products.js` e `Marketplace.jsx`), sem tirar acento. Plano: função `fold()` (remove acento + minúsculas) em nome, espécie, descrição e vendedor, igual já é feito em `/sellers` e no combobox de espécie.
- [ ] **9. Fechamento** — revisão de segurança, testes, `npm run build`, deploy

## Notas de arquitetura (estado real do repo)
- Front nunca fala direto com o banco: tudo passa por `api/*` (Vercel) com service role.
- Sessão = Supabase Auth (token Bearer). A API valida o token em `api/_lib/auth.js` e acha o `usuario` por `auth_user_id`.
- Status de pedido concluído = `entregue`.
- Pedido tem produtos de um único vendedor (`entrega.vendedor_id`).

## Limite da Vercel Hobby: 12 funções serverless
Cada arquivo em `api/` (fora de `_lib/`) conta como 1 função. Hoje são 10:
`auth/{register,me,complete-profile,legacy}`, `cart`, `checkout`, `orders`, `products`, `profile`, `people`.
A avaliação (módulo 5) entrou dentro de `orders.js` (`?resource=review`) e não gastou vaga. Sobram 2: o módulo 6 (denúncias, `/api/report`) usa 1. Não criar arquivos extras em `api/`.

## Decisões do módulo 5
- O comentário da avaliação fica guardado só pra moderação; o perfil público mostra apenas média, total e distribuição por estrela (como no plano original).
- Avaliação enviada é imutável (trigger no banco): nota/autor/pedido não mudam.
