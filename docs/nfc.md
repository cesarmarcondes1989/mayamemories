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
| Ativo | página da Maya; pede e-mail se a pessoa não estiver conectada |
| Suspenso | “acesso indisponível” (reversível) |
| Revogado / Substituído | “acesso indisponível” (definitivo) |

Chaveiro perdido: Painel → Tokens → “Chaveiro perdido: substituir”. O token antigo para de funcionar, um novo é
criado para a mesma pessoa e **nenhuma memória é perdida** (memórias pertencem à pessoa, não ao token).
