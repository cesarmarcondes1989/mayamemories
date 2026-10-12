# Maya Memories

> Um legado familiar digital, construído por pessoas importantes na vida da Maya.
> Da gestação (2026) ao aniversário de 15 anos (2042).

Plataforma privada para registrar, organizar e preservar memórias — fotos, vídeos, áudios, mensagens,
visitas e cartas para o futuro — organizadas em uma **linha do tempo** e em **cápsulas do tempo**.
A porta de entrada é um ursinho com um coração NFC: aproximou o celular, abriu o site. Sem app.

**Stack:** Next.js 15 (App Router, TypeScript, Tailwind 4) · Supabase (Postgres, Auth, Storage, RLS) · Vercel · n8n (opcional).

## Princípios que o código garante

| Princípio | Onde é garantido |
| --- | --- |
| Nada é publicado sem aprovação dos pais | `guard_memories` + `submit_memory`/`moderate_memory` (banco) |
| Ninguém se promove a administrador | `person_roles` sem políticas de escrita; só `admin_set_role` |
| Cápsulas e cartas não abrem antes da hora — nem por URL direta | `capsule_is_open()` / `memory_viewable()` avaliados **a cada consulta** |
| Arquivos privados, sem URL pública permanente | bucket privado + política de leitura = `memory_viewable` + URLs assinadas de 1h |
| Upload só para caminhos pré-registrados | política de INSERT no Storage exige `media_assets` `pending_upload` do próprio autor |
| Tipo real do arquivo verificado | assinatura (“magic bytes”) checada no servidor antes de marcar `ready` |
| NFC é porta de entrada, não chave mestra | `resolve_nfc_token` não autentica e não cria visita |
| Acesso ≠ contribuição ≠ visita | indicadores separados em `admin_people_overview` |
| Auditoria imutável | `audit_events` append-only (trigger bloqueia UPDATE/DELETE) |
| Exportável sem depender do frontend | `scripts/export-media.mjs` + `/api/admin/export` |

## Começando (desenvolvimento)

```bash
npm install
cp .env.example .env.local        # preencha com um projeto Supabase de DEV
npx supabase link --project-ref <ref-dev>
npx supabase db push              # aplica supabase/migrations
npm run bootstrap:admin -- voce@email.com "Seu Nome" pai
npm run dev
```

## Qualidade

```bash
npm run lint && npm run typecheck && npm test   # app
npm run test:db                                  # migrações + ~120 asserts de RLS/autorização (Postgres local)
```

O CI (`.github/workflows/ci.yml`) roda tudo isso em cada push/PR, incluindo os testes de autorização
contra um Postgres real.

## Documentação

- [docs/deployment.md](docs/deployment.md) — **passo a passo Supabase + Vercel** (comece por aqui)
- [docs/architecture.md](docs/architecture.md) — módulos, fluxos e decisões
- [docs/permissions.md](docs/permissions.md) — papéis, visibilidade e matriz de acesso
- [docs/database.md](docs/database.md) — modelo de dados
- [docs/backup.md](docs/backup.md) — backup, exportação e teste de restauração
- [docs/automations.md](docs/automations.md) — integração com n8n
- [docs/nfc.md](docs/nfc.md) — gravação das etiquetas NFC

## Estrutura

```
app/(public)        landing, entrar, convite, NFC (/m/[token]), privacidade
app/(contributor)   início, enviar/*, cartas, visitas, linha do tempo, cápsulas, perfil
app/(admin)/admin   painel, aprovação, memórias, pessoas, convites, tokens, cápsulas, auditoria…
app/api             exportação (admin) e automações (n8n, Bearer)
features/           ações de servidor e consultas por domínio
lib/                supabase, permissões, validação, storage
supabase/           migrações versionadas, testes de RLS, templates de e-mail
scripts/            bootstrap do 1º admin, exportação de mídia, backup
```
