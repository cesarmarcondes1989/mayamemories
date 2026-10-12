# Etiquetas NFC (coração do ursinho)

- Etiqueta: **NTAG213** (144 bytes) é suficiente; NTAG215 se quiser folga.
- Conteúdo: **um único registro URL** — `https://seu-dominio.com.br/m/<public_id>` (copie em Painel → Tokens NFC).
- Nenhum dado pessoal na etiqueta. O UID físico da etiqueta **não** é usado como segurança.
- Gravação: app *NFC Tools* (iOS/Android) → Write → Add record → URL → aproximar a etiqueta.
- Teste em um iPhone e em um Android **antes** de bloquear.
- Depois de testado: *Lock tag* (impede regravação maliciosa). É irreversível.

## Ciclo de vida

| Estado | Efeito ao aproximar o celular |
| --- | --- |
| Preparado | “acesso indisponível” (ainda não entregue) |
| Ativo | entra **direto** como a pessoa do ursinho (sem e-mail, sem confirmação) |
| Suspenso | “acesso indisponível” (reversível) |
| Revogado / Substituído | “acesso indisponível” (definitivo) |

Chaveiro perdido: Painel → Tokens → “Chaveiro perdido: substituir”. O token antigo para de funcionar, um novo é
criado para a mesma pessoa e **nenhuma memória é perdida** (memórias pertencem à pessoa, não ao token).

## Acesso direto (token = identidade)

O token é intransferível: pertence a uma pessoa e sempre abre como ela, em qualquer celular.
Na primeira vez o sistema cria a conta da pessoa automaticamente (sem enviar e-mail).

Travas de segurança:
- só tokens **ativos** e ligados a uma pessoa entram direto (token de campanha pede e-mail);
- o acesso é de **contribuinte**: tudo que a pessoa envia continua passando pela aprovação;
- ursinho de **administrador** nunca abre o painel — admins entram por e-mail;
- revogar, suspender ou substituir o token corta novos acessos na hora;
- cada acesso direto fica na auditoria (`nfc.direct_access`).

Consequência: quem tiver o ursinho (ou copiar a URL) age como aquela pessoa. Trate a URL como uma chave.
