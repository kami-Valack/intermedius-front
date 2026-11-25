# Contrato de API sugerido

Caminhos relativos a `API_BASE_URL`. Autenticação: `Authorization: Bearer <token>`.

| Recurso | Endpoint | Regras |
|---|---|---|
| Conta | `POST /auth/phone-verifications`, `POST /auth/phone-verifications/verify`, `POST /auth/register`, `POST /auth/login`, `GET /auth/me` | Papéis: client, owner, agent, admin. Owner/agent aguardam validação de BI/NIF. O registo exige verificação do telefone por OTP Ombala. Palavras-passe com hash (argon2/bcrypt). |
| Imóveis | `GET/POST /properties`, `PATCH /properties/:id` | POST exige ≥5 fotos (vídeo opcional). 409 se já existir imóvel com mesma província+município+bairro+morada. Estado: pending_review → active / rejected. Morada exata só após visita paga. |
| Média | `POST /uploads` (multipart) | Storage (S3/R2); devolver URL. Hoje as fotos vão em base64 no localStorage. |
| Intermediários | `POST /properties/:id/agents`, `PATCH /agent-links/:id` | Máx. 5 vínculos ativos (pending+approved) por imóvel. Publicador convida; intermediário aceita. |
| Comunidade | `GET/POST /community/requests`, `POST /community/requests/:id/offers` | Pedido: categoria, tipologia, município, bairro, orçamento. Notificar donos/intermediários com imóvel ativo no mesmo município+tipologia. Dono e intermediário aceitam em separado. |
| Visitas | `POST /visits`, `POST /visits/checkin` | Só após pagamento confirmado. Código INT-xxxx no check-in. |
| Pagamentos | `POST /payments/emis/webhook` | Webhook assinado do EMIS GPO confirma visita/renda. Nunca confiar no cliente. |
| Arrendamento | `POST /rentals` | Contrato após confirmação do webhook. Cliente paga renda + comissão da plataforma; comissão do intermediário é do proprietário. |
| Notificações | `GET /notifications` (+ push/e-mail/SMS) | Hoje só toast e contador no menu. |
| Config | `GET/PATCH /settings` (admin) | Taxa de visita, % plataforma, % intermediário. |

Chaves de localStorage a migrar: `inter_users`, `inter_current`, `inter_custom_properties`, `inter_property_agents`, `inter_visits`, `inter_availability`, `inter_rent_contracts`, `inter_rent_transactions`, `inter_agent_commissions`, `inter_community_requests`, `inter_community_offers`, `inter_visit_fee`, `inter_platform_commission_pct`, `inter_agent_commission_pct`.

### Verificação do telefone no registo

1. Pedir OTP: `POST /auth/phone-verifications` com `{ "phone": "+244 923 000 000" }`. A resposta deve incluir `verification_id`.
2. Validar o OTP: `POST /auth/phone-verifications/verify` com `{ "verification_id": "<uuid>", "code": "123456" }`. O frontend só considera o telefone verificado quando a resposta inclui `verified: true`.
3. Criar a conta: `POST /auth/register` deve incluir `phone_verification_id` com o ID devolvido, para que o backend associe e valide a verificação. O código OTP não é enviado no registo.
