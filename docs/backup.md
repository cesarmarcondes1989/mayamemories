## Exportação pelo painel (ZIP)

Em **Admin → Exportação**, o botão “Baixar tudo” gera um ZIP montado em fluxo no servidor (sem carregar tudo na
memória), dividido em partes de ~500 MB para caber no tempo máximo da função (300 s na Vercel). A parte 1 traz
`index.html` (abre offline com a história inteira), `LEIA-ME.txt`, `manifest.json` e planilhas em `dados/`.
As mídias ficam em `media/ANO/fotos|videos|audios/` com a data do momento no nome. Extraia todas as partes
na mesma pasta.

# Backup, exportação e restauração

Um arquivo de família para décadas não pode depender de uma única conta ou provedor.

## Rotina recomendada

| Frequência | O quê | Como |
| --- | --- | --- |
| Contínuo | Banco | Supabase Pro: backups diários / PITR |
| Semanal | Banco + arquivos, cópia independente | `npm run backup -- /caminho/externo` |
| Mensal | Pacote legível (sem depender do banco) | Painel → Exportação → `manifest.json` + `npm run export:media` |
| Semestral | **Teste de restauração** | abaixo |

`npm run backup` gera `database.dump` (pg_dump), `files/` (manifesto + mídia), `SHA256SUMS` e `backup-run.json`.
Guarde em pelo menos dois lugares (ex.: HD externo criptografado + nuvem pessoal diferente). Os arquivos contêm
dados de uma criança: criptografe (ex.: `age`, `gpg`, VeraCrypt) e restrinja o acesso.

Variáveis necessárias: `SUPABASE_DB_URL` (Project Settings → Database → Connection string, *session pooler*),
`NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.

## Teste de restauração

1. Crie um projeto Supabase **descartável**.
2. `pg_restore --no-owner --no-privileges -d "<db-url-descartável>" --schema=public database.dump`
   (ou `npx supabase db push` + restaurar só os dados).
3. Suba os arquivos: para cada item de `manifest.media`, envie `files/media/<storage_path>` para o bucket `memories`
   no mesmo caminho (script simples com `supabase.storage.from('memories').upload`).
4. Aponte um deploy de preview para esse projeto e confira: linha do tempo, uma foto, um vídeo, um áudio e uma cápsula aberta.
5. Confira `sha256sum -c SHA256SUMS`.
6. Registre a data e o resultado. **Só então** o backup é considerado confiável.

## Exclusão

Remover uma memória (aprovação → Excluir, ou pedido do autor aceito) apaga os arquivos do Storage,
desfaz vínculos com cápsulas e marca os registros como removidos. Cópias em backups antigos expiram conforme
a política de retenção que vocês definirem (sugestão: manter 12 backups mensais).
