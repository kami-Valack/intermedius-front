# Integração do frontend com a API

## Estado atual

`config.js` está configurado com `USE_API: true` e `API_BASE_URL: 'https://intermed.api.drip.infinityfree.me/api/v1'`.

O catálogo público usa `GET /properties` e percorre as páginas devolvidas pela API. A área administrativa usa a API para indicadores, aprovação de contas e imóveis, pagamentos, configurações e a lista paginada de valores/destinos dos proprietários. Proprietários e intermediários podem consultar e atualizar os dados bancários associados à sua própria conta; o painel do intermediário também carrega imóveis, convites/vínculos, visitas e disponibilidade da API. O registo, autenticação, pagamentos e operações da comunidade também têm chamadas à API, embora o carregamento inicial da comunidade ainda precise ser verificado. O token Bearer fica em `localStorage['inter_token']`.

## Contrato de endpoints

Esta tabela descreve o contrato previsto para completar a integração; a presença de um método em `api.js` não significa que todas as telas já o utilizem.

| Site (localStorage) | API |
|---|---|
| `inter_users`, `inter_current` | `POST /auth/phone-verifications`, `POST /auth/phone-verifications/verify`, `POST /auth/register`, `POST /auth/login`, `GET /auth/me` |
| `inter_custom_properties` | `GET /properties`, `POST /properties` (multipart), `GET /properties/mine` (intermediário), admin: `GET /admin/properties?status=pending_review`, `PATCH /admin/properties/{id}` |
| `inter_property_agents` | `POST /properties/{id}/agents` (publicador), `GET /agent-links`, `PATCH /agent-links/{id}` (intermediário aceita com `approved` ou recusa com `rejected`; proprietário pode revogar com `revoked`) |
| `inter_availability` | `GET/PUT /availability` (intermediário; dias 1=segunda … 7=domingo; domingo `0` do formulário é enviado como `7`) |
| dados bancários do proprietário/intermediário | `GET/PUT /bank-details` (`iban` e `express_number`; requer Bearer token e guarda os dados do utilizador autenticado) |
| `inter_visits` | `GET/POST /visits`, `POST /visits/checkin` (visitas atribuídas são carregadas da API; o código só aparece após pagamento confirmado) |
| `inter_rent_*`, `inter_agent_commissions` | `GET/POST /rentals`, `GET /commissions`, `PATCH /commissions/{id}/pay` |
| `inter_community_*` | `GET/POST /community/requests`, `POST /community/requests/{id}/offers`, `PATCH …/close` |
| notificações (toast/contador) | `GET /notifications`, `POST /notifications/read-all` |
| área administrativa | `GET /admin/stats`, `GET /admin/users?status=pending_review`, `PATCH /admin/users/{id}`, `GET /admin/payments`, `GET/PUT /admin/settings`, `GET /admin/owner-payouts?page=1&per_page=20` |

O painel **Valores e destinos dos proprietários** mostra o valor mensal devido como soma das rendas de arrendamentos ativos, a contagem desses arrendamentos e os dados bancários registados. Não é saldo histórico de repasses: a API ainda não regista pagamentos feitos aos proprietários.

**Publicar imóvel:** enviar `multipart/form-data` com `photos[]` (5 a 10 imagens), `video` (opcional) e os campos do formulário em `snake_case` (`private_address`, `private_lat`, `private_lng`). Respostas de erro: `422` validação (`errors`), `409` imóvel duplicado, `422` com `code` (`agent_limit`, `slot_taken`, `offer_required`…).
As URLs de mídia devolvidas pela API têm de ser acessíveis pelo navegador. O frontend converte URLs absolutas com host `localhost` (e caminhos `/storage/...`) para o mesmo caminho no host de `API_BASE_URL`, por exemplo `http://localhost/storage/properties/3/foto.jpg` passa a `https://intermed.api.drip.infinityfree.me/storage/properties/3/foto.jpg`. Se essa URL responder `404`, configure o storage público do Laravel (por exemplo, `php artisan storage:link`) e confirme que os ficheiros existem.
**OTP Ombala no registo:** o frontend pede o código com `POST /auth/phone-verifications` e `{ "phone": "+244 923 000 000" }`. A resposta deve conter `verification_id` (diretamente ou em `data`). Em seguida envia `{ "verification_id": "<uuid>", "code": "123456" }` para `POST /auth/phone-verifications/verify` e só prossegue se a API devolver `verified: true`. O `POST /auth/register` recebe o mesmo ID no campo `phone_verification_id`; o código OTP nunca é enviado no registo.
**Pagamentos GPO FACI:** o frontend comunica exclusivamente com a API do backend; não chama a GPO nem recebe a chave do provedor. A interface disponibiliza apenas `GPO FACI — cobrança no telemóvel e referência`, e envia `payment_method: "reference"`:

- `POST /visits`: `{ property_id, scheduled_at, payment_method: "reference" }`. O backend usa o nome e telefone do utilizador autenticado.
- `POST /rentals`: `{ property_id, tenant, phone, nif, start_date, duration_months, payment_method: "reference" }`. O telefone móvel deve estar no formato angolano `2449XXXXXXXX`.
- `PATCH /commissions/{id}/pay`: `{ payment_method: "reference" }`.

Os três endpoints devem devolver o recurso em `data`, com `payment.reference`, `payment.amount`, `payment.currency`, `payment.status` e, quando disponíveis, `payment.data.message` e `payment.data.charge_requested`. `charge_requested: true` confirma apenas que o pedido móvel foi enviado; não confirma pagamento. A interface considera pago somente `payment.status === "paid"` e, para visita, também exige que `paid`/`status` da visita confirme. O contrato/estado ativo de arrendamento só é mostrado depois de o backend devolver pagamento `paid` e arrendamento `active`.

Enquanto o pagamento estiver pendente, o frontend consulta `GET /visits`, `GET /rentals` ou `GET /commissions` a cada 25 segundos e permite atualização manual. Ao falhar um POST, consulta primeiro a lista correspondente antes de permitir nova tentativa, pois o recurso pode ter sido criado apesar da falha de resposta. As listas usam o envelope Laravel paginado em `data`. O frontend não consulta endpoints GPO diretamente; a confirmação e atualização das rotas são responsabilidade do backend.
**Tempo real:** as notificações são por consulta (`GET /notifications`, ex. a cada 30–60 s). Para tempo real acrescente Laravel Reverb/Pusher.

**Painel do intermediário:** ao abrir a área profissional, o frontend percorre as páginas de `GET /properties/mine`, `GET /agent-links` e `GET /visits`, e lê `GET /availability`. Só os vínculos cujo `agent_id` corresponde ao utilizador autenticado são apresentados como convites recebidos. Aceitar e recusar enviam `PATCH /agent-links/{id}` com `{ "status": "approved" }` ou `{ "status": "rejected" }`; depois, os dados são novamente lidos da API. A disponibilidade é gravada com `PUT /availability` e o check-in é validado com `POST /visits/checkin`. Erros de carregamento são apresentados sem recorrer aos dados de demonstração.

**PWA/cache:** ao alterar ficheiros JavaScript ou configuração incluídos no service worker, aumenta a versão de cache em `sw.js`. Se o navegador continuar a carregar uma versão antiga, faça uma recarga forçada ou limpe os dados do site.
