# Deploy — Supabase + Vercel

Tempo estimado: 30–40 min. Faça primeiro em um projeto de **desenvolvimento**, depois repita em **produção**
(ambientes separados, chaves separadas).

## 1. Supabase

1. Crie o projeto em <https://supabase.com/dashboard> — região **South America (São Paulo)**.
2. **Migrações** (pelo terminal, na raiz do repositório):
   ```bash
   npx supabase login
   npx supabase link --project-ref <ref>
   npx supabase db push
   ```
   Isso cria tabelas, RLS, funções, bucket privado `memories` e as cápsulas iniciais.
3. **Authentication → Sign In / Providers**
   - Email: habilitado. **“Allow new users to sign up”: DESLIGADO.** Contas nascem pelo servidor: convite,
     ursinho/mesa ou o cadastro aberto em `/comecar` (Admin API, com freios no banco).
   - Confirm email: pode ficar ligado.
4. **Authentication → URL Configuration**
   - Site URL: `https://seu-dominio.com.br`
   - Redirect URLs: `https://seu-dominio.com.br/**` (e a URL de preview da Vercel, se quiser testar previews).
5. **Authentication → Emails → Templates** — *obrigatório*. Cole o HTML de:
   - `supabase/templates/magic_link.html` em **Magic Link** (assunto: “Seu link de acesso ao Maya Memories”)
   - `supabase/templates/invite.html` em **Invite user** (assunto: “Você faz parte da história da Maya”)
   - `supabase/templates/email_change.html` em **Change Email Address** (assunto: “Confirme seu e-mail”)

   E em **Authentication → Sign In / Providers → Email**, desligue **“Secure email change”**: quem entrou
   pelo ursinho tem um e-mail interno que não recebe mensagens, então a confirmação vai só para o e-mail novo.

   Esses templates usam `/auth/confirm?token_hash=…`, que funciona mesmo se o e-mail for aberto em outro
   app/navegador do celular.
   Em **Authentication → Multi-Factor**, deixe **TOTP (App Authenticator)** habilitado. O dono da plataforma
   (`/plataforma`) é obrigado a usar 2 fatores — a exigência está no banco (`is_platform_admin_strong`, aal2).
6. **Authentication → SMTP**: configure um SMTP próprio (Resend, Postmark, SES…). O SMTP padrão do Supabase
   tem limite muito baixo de envios por hora.
7. **Storage → Settings**: ajuste o *global file size limit* para comportar vídeos (plano Free = 50 MB; no Pro
   você pode subir para 500 MB). O limite por tipo de arquivo é configurado no painel do app.
8. **Project Settings → API**: copie `URL`, `anon key` e `service_role key`.

## 2. Vercel

1. *Add New → Project* → importe `cesarmarcondes1989/mayamemories`. Framework: Next.js (detectado).
2. **Environment Variables** (Production e Preview, com projetos Supabase diferentes se possível):

   | Variável | Valor | Exposta ao navegador? |
   | --- | --- | --- |
   | `NEXT_PUBLIC_SUPABASE_URL` | URL do projeto | sim (protegida por RLS) |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon key | sim (protegida por RLS) |
   | `NEXT_PUBLIC_SITE_URL` | `https://seu-dominio.com.br` | sim |
   | `SUPABASE_SERVICE_ROLE_KEY` | service role | **não** — nunca prefixe com `NEXT_PUBLIC_` |
   | `AUTOMATION_WEBHOOK_SECRET` | `openssl rand -hex 32` | **não** |
   | `ADMIN_BOOTSTRAP_EMAILS` | seu e-mail (primeiro acesso) | **não** |

3. Deploy. `vercel.json` fixa a região `gru1` (São Paulo), perto do banco.
4. **Domains**: adicione o domínio próprio. Ele precisa ser **estável** — é ele que vai gravado nos corações NFC.

## 3. Primeiro administrador (uma única vez)

**Pelo site (mais simples):** adicione na Vercel `ADMIN_BOOTSTRAP_EMAILS=seu@email.com`, faça redeploy, abra
`/entrar` e peça o link com esse e-mail. Ao clicar no e-mail você cai em `/primeiro-acesso` e vira admin.
Funciona só enquanto não existir nenhum administrador. Diagnóstico: `/api/health` mostra o que falta configurar.

**Ou pelo terminal:** no seu computador, com `.env.local` apontando para o projeto de produção:

```bash
npm run bootstrap:admin -- cesar@email.com "Cesar" pai
```

- Não existe senha padrão. O e-mail recebe um convite; o acesso é por link mágico.
- O banco **recusa** criar um segundo admin por esse caminho.
- Ana entra como qualquer convidada (Pessoas → Adicionar → Convites) e recebe o papel de administradora
  pelo painel (Pessoas → Ana → Permissões).

## 4. Checklist de produção

- [ ] Cadastro público desligado no Supabase Auth
- [ ] Templates de e-mail customizados e SMTP próprio
- [ ] `SUPABASE_SERVICE_ROLE_KEY` só no servidor (Vercel), nunca no código
- [ ] `npm run test:db` verde no CI
- [ ] Teste no celular: convite → link mágico → enviar foto, vídeo e áudio → aprovar → ver na linha do tempo
- [ ] Teste: carta com data futura não aparece para a família
- [ ] Teste: token NFC revogado mostra “acesso indisponível”
- [ ] Backup + **teste de restauração** feitos (docs/backup.md)
- [ ] Ponto de recuperação (PITR) ou backups diários habilitados no Supabase (plano Pro)

## Atualização para multi-cliente (migração 009)

A migração `20261017000009_multi_vault.sql` transforma os dados atuais no baú `maya` e o primeiro
administrador em dono da plataforma. Ela é testada contra uma cópia do formato antigo
(`scripts/test-db.sh`, teste "upgrade"), mas **faça um backup antes**:
Supabase → Database → Backups (ou `npm run backup`), e só então `npx supabase db push`.

## Atualizações futuras do banco

Nunca altere migrações já aplicadas. Crie um novo arquivo em `supabase/migrations/` e rode `npx supabase db push`.
Atenção: funções novas no schema `public` recebem EXECUTE para `anon`/`authenticated` por padrão no Supabase —
revogue explicitamente o que não deve ser público (veja o final de `..._workflows.sql`).

## Analytics da vitrine

- Coletor próprio em `/api/a` (sem serviço de terceiros). Grava em `analytics_events` pelo service role.
- Não guarda IP nem User-Agent completo; região vem dos cabeçalhos de geolocalização da Vercel.
- Identificador de visitante só com o aceite de cookies (banner na vitrine).
- Retenção: rode `select public.analytics_prune();` uma vez por mês (apaga eventos com mais de 13 meses).

## Cadastro aberto (`/comecar`)

- Cria conta + baú Grátis e já entra logado como dono. Liga/desliga e limite de baús por conta em
  `/plataforma/marca`.
- O e-mail nasce como não confirmado (`app_metadata.email_verified = false`). Enquanto isso a pessoa usa o
  próprio baú, mas o e-mail não aceita convites de outros baús. Ao abrir qualquer link enviado ao e-mail,
  a conta é confirmada.
- Quem escolhe um plano pago no site começa no Grátis e aparece em `/plataforma/interessados`.
