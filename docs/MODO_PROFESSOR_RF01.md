# Roteiro de teste manual — RF01

Use um projeto de desenvolvimento ligado a um banco Supabase de teste. A migration a aplicar é `supabase/modulo14_rf01_data_nascimento_endereco.sql`.

## Cadastro e login

1. Configure as variáveis de ambiente locais para um projeto Supabase de teste.
2. Aplique `supabase/modulo14_rf01_data_nascimento_endereco.sql` nesse banco e inicie as rotas Vercel localmente com `npm run dev:vercel` (com a CLI da Vercel disponível).
3. Abra cadastro de comprador e informe CPF matematicamente válido, nome com duas palavras, nascimento com 18 anos ou mais, endereço e credenciais.
4. Confirme o e-mail quando solicitado e entre com o mesmo e-mail e senha.
5. Repita o fluxo como vendedor usando CPF. Para CNPJ, confira que a razão social continua bloqueada e o nome fantasia continua editável.
6. Teste nascimento de 17 anos: deve bloquear com “Você precisa ter pelo menos 18 anos para se cadastrar no QUÉX.”
7. Teste data futura, data inválida e idade acima de 120: todas devem ser rejeitadas.
8. Tente enviar diretamente à API nome inválido, data fora da faixa, CPF com dígitos incorretos e endereço sem rua/bairro; o backend deve rejeitar cada caso.
9. Verifique “Meu Perfil”: a data aparece somente para a conta autenticada. Abra o perfil público e confirme que a data não aparece.

## CEP e endereço

1. No cadastro, em Meu Perfil e em completar cadastro, digite um CEP conhecido (por exemplo, `01001-000`).
2. Confirme o preenchimento de Rua, Bairro, Cidade e UF. Edite Rua/Bairro, se necessário, e salve.
3. Consulte a linha do usuário no banco: `data_nascimento`, `rua` e `bairro` devem estar preenchidos.
4. No checkout, confirme o endereço de entrega completo e o link para editar em Meu Perfil.
5. Em um pedido de teste, confirme o endereço no detalhe do pedido e no painel administrativo.
6. Para vendedor com entrega ativa e coordenadas atualizadas, confira que o cálculo de distância continua funcionando. O geocoding usa rua, número, bairro, cidade e UF.

## Verificações locais opcionais

- `npm run check` faz parse dos arquivos listados pelo projeto.
- `npm run build` compila o frontend Vite.
- Não execute os comandos apontando para dados reais de clientes durante os testes.
