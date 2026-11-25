# Integração do frontend com a API

## Estado atual

`config.js` está configurado com `USE_API: true` e `API_BASE_URL: 'https://intermed.api.drip.infinityfree.me/api/v1'`.

O catálogo público usa `GET /properties` e percorre as páginas devolvidas pela API. A área administrativa usa agora a API para indicadores, aprovação de contas e imóveis, pagamentos e leitura/actualização das configurações. O registo, autenticação, favoritos, pagamentos de visitas/arrendamentos/comissões, check-in e operações da comunidade também têm chamadas à API. O token Bearer fica em `localStorage['inter_token']`.

Ainda há painéis profissionais que usam cache `localStorage` como fonte de apresentação, incluindo imóveis próprios/vinculados, visitas e disponibilidade. A comunidade também precisa carregar inicialmente a lista da API ao abrir o painel. A flag `USE_API: true` não converte automaticamente esses painéis; consultar os pontos em falta antes de considerar a migração completa.

## Contrato de endpoints

Esta tabela descreve o contrato previsto para completar a integração; a presença de um método em `api.js` não significa que todas as telas já o utilizem.

| Site (localStorage) | API |
|---|---|
| `inter_users`, `inter_current` | `POST /auth/phone-verifications`, `POST /auth/phone-verifications/verify`, `POST /auth/register`, `POST /auth/login`, `GET /auth/me` |
| `inter_custom_properties` | `GET /properties`, `POST /properties` (multipart), `GET /properties/mine`, admin: `GET /admin/properties?status=pending_review`, `PATCH /admin/properties/{id}` |
| `inter_property_agents` | `POST /properties/{id}/agents`, `GET /agent-links`, `PATCH /agent-links/{id}` |
| `inter_availability` | `GET/PUT /availability` (dias 1=segunda … 7=domingo) |
| `inter_visits` | `GET/POST /visits`, `POST /visits/checkin` |
| `inter_rent_*`, `inter_agent_commissions` | `GET/POST /rentals`, `GET /commissions`, `PATCH /commissions/{id}/pay` |
| `inter_community_*` | `GET/POST /community/requests`, `POST /community/requests/{id}/offers`, `PATCH …/close` |
| notificações (toast/contador) | `GET /notifications`, `POST /notifications/read-all` |
| área administrativa | `GET /admin/stats`, `GET /admin/users?status=pending_review`, `PATCH /admin/users/{id}`, `GET /admin/payments`, `GET/PUT /admin/settings` |

**Publicar imóvel:** enviar `multipart/form-data` com `photos[]` (5 a 10 imagens), `video` (opcional) e os campos do formulário em `snake_case` (`private_address`, `private_lat`, `private_lng`). Respostas de erro: `422` validação (`errors`), `409` imóvel duplicado, `422` com `code` (`agent_limit`, `slot_taken`, `offer_required`…).
As URLs de mídia devolvidas pela API têm de ser acessíveis pelo navegador. Se `/storage/...` responder `404`, configure o storage público do Laravel (por exemplo, `php artisan storage:link`) e confirme que os ficheiros existem.
**OTP Ombala no registo:** o frontend pede o código com `POST /auth/phone-verifications` e `{ "phone": "+244 923 000 000" }`. A resposta deve conter `verification_id` (diretamente ou em `data`). Em seguida envia `{ "verification_id": "<uuid>", "code": "123456" }` para `POST /auth/phone-verifications/verify` e só prossegue se a API devolver `verified: true`. O `POST /auth/register` recebe o mesmo ID no campo `phone_verification_id`; o código OTP nunca é enviado no registo.
**Pagamentos GPO FACI:** o frontend comunica exclusivamente com a API do backend; não chama a GPO nem recebe a chave do provedor. A interface disponibiliza apenas `GPO FACI — cobrança no telemóvel e referência`, e envia `payment_method: "reference"`:

- `POST /visits`: `{ property_id, scheduled_at, payment_method: "reference" }`. O backend usa o nome e telefone do utilizador autenticado.
- `POST /rentals`: `{ property_id, tenant, phone, nif, start_date, duration_months, payment_method: "reference" }`. O telefone móvel deve estar no formato angolano `2449XXXXXXXX`.
- `PATCH /commissions/{id}/pay`: `{ payment_method: "reference" }`.

Os três endpoints devem devolver o recurso em `data`, com `payment.reference`, `payment.amount`, `payment.currency`, `payment.status` e, quando disponíveis, `payment.data.message` e `payment.data.charge_requested`. `charge_requested: true` confirma apenas que o pedido móvel foi enviado; não confirma pagamento. A interface considera pago somente `payment.status === "paid"` e, para visita, também exige que `paid`/`status` da visita confirme. O contrato/estado ativo de arrendamento só é mostrado depois de o backend devolver pagamento `paid` e arrendamento `active`.

Enquanto o pagamento estiver pendente, o frontend consulta `GET /visits`, `GET /rentals` ou `GET /commissions` a cada 25 segundos e permite atualização manual. Ao falhar um POST, consulta primeiro a lista correspondente antes de permitir nova tentativa, pois o recurso pode ter sido criado apesar da falha de resposta. As listas usam o envelope Laravel paginado em `data`. O frontend não consulta endpoints GPO diretamente; a confirmação e atualização das rotas são responsabilidade do backend.
**Tempo real:** as notificações são por consulta (`GET /notifications`, ex. a cada 30–60 s). Para tempo real acrescente Laravel Reverb/Pusher.

**PWA/cache:** ao alterar ficheiros JavaScript ou configuração incluídos no service worker, aumenta a versão de cache em `sw.js`. Se o navegador continuar a carregar uma versão antiga, faça uma recarga forçada ou limpe os dados do site.
