# QUÉX — plano em módulos

Cada módulo fecha sozinho (build passando) antes de começar o próximo.

- [x] **1. Banco** — `supabase/modulo1_migration.sql` (usuario+campos, especie, avaliacao, denuncia, resumo anônimo, RLS)
- [x] **2. Auth** — Supabase Auth como identidade (`usuario.auth_user_id`), CPF/CNPJ validado em front + API + banco, confirmação de e-mail (`is_active`), Google OAuth, `/complete-profile`, recuperação de senha, migração das contas antigas
- [ ] **3. Perfis** — foto no Storage, bio, localização, perfil público, busca de vendedores (`/sellers`, `/seller/:id`)
- [ ] **4. Produtos** — combobox de espécie (`especie_id`), upload múltiplo de fotos, trocar `fotos_url` de URL solta pra lista de arquivos
- [ ] **5. Avaliações** — API + UI (só pedido `entregue`, anônimas, resumo via `avaliacao_resumo`)
- [ ] **6. Denúncias** — modal, `/api/report`, e-mail via Resend
- [ ] **7. Layout** — header com 2 destinos + dropdown, configurações (dark mode, fonte, contraste), footer, FAQ flutuante
- [ ] **8. Visual** — parallax da Home, padding dos ícones nos inputs, animações padronizadas
- [ ] **9. Fechamento** — revisão de segurança, testes, `npm run build`, deploy

## Notas de arquitetura (estado real do repo)
- Front nunca fala direto com o banco: tudo passa por `api/*` (Vercel) com service role.
- Sessão = Supabase Auth (token Bearer). A API valida o token em `api/_lib/auth.js` e acha o `usuario` por `auth_user_id`.
- Status de pedido concluído = `entregue`.
- Pedido tem produtos de um único vendedor (`entrega.vendedor_id`).
