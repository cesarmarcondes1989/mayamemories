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
   - Email: habilitado. **“Allow new users to sign up”: DESLIGADO.** Contas só nascem por convite.
   - Confirm email: pode ficar ligado.
4. **Authentication → URL Configuration**
   - Site URL: `https://seu-dominio.com.br`
   - Redirect URLs: `https://seu-dominio.com.br/**` (e a URL de preview da Vercel, se quiser testar previews).
5. **Authentication → Emails → Templates** — *obrigatório*. Cole o HTML de:
   - `supabase/templates/magic_link.html` em **Magic Link** (assunto: “Seu link de acesso ao Maya Memories”)
   - `supabase/templates/invite.html` em **Invite user** (assunto: “Você faz parte da história da Maya”)

   Esses templates usam `/auth/confirm?token_hash=…`, que funciona mesmo se o e-mail for aberto em outro
   app/navegador do celular.
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

3. Deploy. `vercel.json` fixa a região `gru1` (São Paulo), perto do banco.
4. **Domains**: adicione o domínio próprio. Ele precisa ser **estável** — é ele que vai gravado nos corações NFC.

## 3. Primeiro administrador (uma única vez)

No seu computador, com `.env.local` apontando para o projeto de produção:

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

## Atualizações futuras do banco

Nunca altere migrações já aplicadas. Crie um novo arquivo em `supabase/migrations/` e rode `npx supabase db push`.
Atenção: funções novas no schema `public` recebem EXECUTE para `anon`/`authenticated` por padrão no Supabase —
revogue explicitamente o que não deve ser público (veja o final de `..._workflows.sql`).
