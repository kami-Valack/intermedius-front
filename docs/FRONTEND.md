# Integração do frontend com a API

## Estado atual

Em desenvolvimento, `config.js` está configurado com `USE_API: true` e `API_BASE_URL: 'http://127.0.0.1:8000/api/v1'`. Altere a URL para o domínio da API ao publicar.

Já fazem pedidos à API: carregamento do catálogo; registo, login e logout; favoritos; criação de imóveis e convites de intermediários; gravação de disponibilidade e check-in; criação de visitas e arrendamentos; pedidos/respostas da comunidade; e gravação das configurações administrativas. O token Bearer fica em `localStorage['inter_token']`.

Algumas áreas de gestão ainda dependem de endpoints e permissões do backend. Visitas, arrendamentos e comissões usam as rotas autenticadas indicadas abaixo para criação e consulta do estado de pagamento.

## Contrato de endpoints

Esta tabela descreve o contrato previsto para completar a integração; a presença de um método em `api.js` não significa que todas as telas já o utilizem.

| Site (localStorage) | API |
|---|---|
| `inter_users`, `inter_current` | `POST /auth/phone-verifications`, `POST /auth/phone-verifications/verify`, `POST /auth/register`, `POST /auth/login`, `GET /auth/me` |
| `inter_custom_properties` | `GET /properties`, `POST /properties` (multipart), `GET /properties/mine`, admin: `PATCH /admin/properties/{id}` |
| `inter_property_agents` | `POST /properties/{id}/agents`, `GET /agent-links`, `PATCH /agent-links/{id}` |
| `inter_availability` | `GET/PUT /availability` (dias 1=segunda … 7=domingo) |
| `inter_visits` | `GET/POST /visits`, `POST /visits/checkin` |
| `inter_rent_*`, `inter_agent_commissions` | `GET/POST /rentals`, `GET /commissions`, `PATCH /commissions/{id}/pay` |
| `inter_community_*` | `GET/POST /community/requests`, `POST /community/requests/{id}/offers`, `PATCH …/close` |
| notificações (toast/contador) | `GET /notifications`, `POST /notifications/read-all` |
| taxas e comissões | `GET/PUT /admin/settings` |

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
