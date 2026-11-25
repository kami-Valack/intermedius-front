# Prompt para criar o backend Laravel do Intermediárius

Copie o prompt abaixo e entregue-o à IA que vai implementar o backend. Aponte-a para este frontend e para os documentos `docs/API.md` e `docs/FRONTEND.md`.

---

## PROMPT

Atua como engenheiro sénior de backend. Implementa um backend REST completo em Laravel para o frontend Intermediárius, um marketplace imobiliário para Angola. O frontend está neste repositório; consulta o código antes de tomar decisões, em especial `api.js`, `config.js`, `docs/API.md`, `docs/FRONTEND.md`, `app.js`, `roles.js`, `rentals.js` e `community.js`.

Não te limites a gerar um plano ou exemplos: implementa uma aplicação funcional, com migrations, modelos, validação, autorização, controladores, serviços, rotas, testes e documentação de execução. Primeiro inspeciona o repositório e identifica se o backend deve ser criado neste repositório ou numa pasta/projeto separado. Não alteres nem apagues funcionalidades do frontend. Se algum requisito for ambíguo, regista a decisão na documentação e escolhe a opção segura e coerente com o contrato abaixo.

### 1. Stack e organização

- Usa uma versão estável e suportada do Laravel compatível com a versão de PHP disponível no ambiente. Confirma as versões antes de instalar dependências.
- Implementa API versionada sob `/api/v1`.
- Usa autenticação por token Bearer, preferencialmente Laravel Sanctum.
- Usa Form Requests para validação e Policies/Gates para autorização.
- Separa regras de negócio em serviços quando houver lógica transacional, de pagamentos, moderação ou geração de contratos.
- Fornece migrations, seeders de desenvolvimento sem credenciais reais, factories e testes Feature.
- Configura CORS para permitir o domínio do frontend por variável de ambiente. Não uses `*` em produção.
- Não guardes documentos, moradas privadas ou segredos em respostas públicas, logs ou repositório.
- Não simules confirmação de pagamento em produção. A integração EMIS GPO deve ser isolada por uma interface/serviço e configurada por variáveis de ambiente.
- Não introduzas dependências desnecessárias. Nunca coloques chaves, credenciais ou segredos no código.

### 2. Contrato HTTP comum

- Prefixo: `/api/v1`.
- Sucesso em JSON. Para operações sem corpo, responde `204`.
- As respostas de `POST /auth/register` e `POST /auth/login` devem conter `token` no nível superior, pois `api.js` lê `response.token`.
- Usa respostas consistentes e documenta o formato escolhido. Para validação, devolve `422` com `{ "message": "...", "errors": { "campo": ["..."] } }`.
- Para conflitos de regra de negócio, devolve `409` (ou `422` quando apropriado) com `message` e `code`, por exemplo `property_duplicate`, `agent_limit`, `slot_taken`, `offer_required`.
- Nunca devolvas sucesso com dados falsos, nem confirmes no cliente uma operação que aguarda webhook.
- Datas devem ser ISO 8601 com timezone. Valores monetários em Kz devem ser inteiros ou decimal seguro, nunca float sujeito a erro de precisão.
- As rotas privadas exigem Bearer token e autorização por papel e propriedade do recurso.

### 3. Papéis, identidade e autenticação

Papéis: `client`, `owner`, `agent`, `admin`.

Implemente:

- `POST /auth/phone-verifications`
- `POST /auth/phone-verifications/verify`
- `POST /auth/register`
- `POST /auth/login`
- `GET /auth/me`
- `POST /auth/logout`

O pedido de OTP recebe `{ "phone": "+244 923 000 000" }` e devolve `verification_id`. A validação recebe `{ "verification_id": "<uuid>", "code": "123456" }` e só confirma quando responde com `verified: true` e o mesmo `verification_id`. Integra o envio com Ombala no servidor; não exponhas credenciais do provedor ao frontend.

Registo recebe `name`, `email`, `phone`, `phone_verification_id`, `nif` opcional, `role`, `password` e, para proprietário/intermediário, documento BI/NIF em multipart (`document`). O servidor deve validar que o ID pertence ao telefone enviado, foi verificado, não expirou e ainda não foi consumido; o OTP não é enviado no registo. Hash de senha com mecanismo Laravel seguro. Não aceite registo público como `admin`; provisiona administradores por comando/seeder seguro.

Contas `owner` e `agent` começam em `pending_review`, aguardando validação documental manual. Clientes podem começar como `active`. Implementa estados documentados e impede ações de publicação/gestão que exijam verificação quando a conta não está aprovada.

Resposta de autenticação, compatível com `api.js`:

```json
{
  "token": "token-bearer",
  "user": {
    "id": 1,
    "name": "Ana Silva",
    "email": "ana@example.com",
    "phone": "+244 923 000 000",
    "role": "owner",
    "status": "pending_review"
  }
}
```

Não devolvas password hash nem URL pública para documentos privados.

### 4. Imóveis e ficheiros

Implementa:

- `GET /properties`
- `GET /properties/{id}`
- `GET /properties/mine`
- `POST /properties`
- `DELETE /properties/{id}`
- `GET /favorites`
- `POST /properties/{id}/favorite`
- `GET /admin/properties`
- `PATCH /admin/properties/{id}`

A listagem pública só inclui imóveis `active`. Aceita filtros `q`, `category`, `province`, `municipality`, `min_price`, `max_price`, `bedrooms`, `sort`, `page` e `per_page`, validando limites de paginação.

O formulário do frontend cria imóvel com os campos:

```text
title, category, type, price, province, municipality, neighborhood,
bedrooms, baths, area, privateAddress, privatePoint, description,
amenities, fotos, vídeo
```

Para a API, padroniza os nomes em `snake_case`:

```text
title, category, type, price, province, municipality, neighborhood,
bedrooms, baths, area, private_address, private_lat, private_lng,
description, amenities[], photos[], video
```

O endpoint `POST /properties` recebe `multipart/form-data`. Exige 5 a 10 imagens válidas; vídeo opcional com limites configuráveis. Armazena mídia em storage e persiste metadados/URLs. A primeira foto é a imagem de capa. Não armazena base64 no banco.

Regras:

- Imóvel criado começa como `pending_review`.
- Verifica duplicidade por província + município + bairro + morada normalizados; responde conflito com `code: "property_duplicate"`.
- Só proprietário/intermediário autenticado e elegível pode cadastrar.
- Só o dono/publicador ou admin pode remover/moderar segundo as regras definidas.
- Estados de imóvel: `pending_review`, `active`, `rejected`, `rented`, `sold`.
- Admin aprova/rejeita por `PATCH /admin/properties/{id}` com `status` e motivo opcional.
- O público recebe apenas dados aproximados de localização. Morada exacta, coordenadas privadas e contactos só podem ser devolvidos a utilizador autorizado depois de visita paga confirmada, ou conforme regra explícita de arrendamento.
- Evita expor endereço privado em serializadores, logs, listagens, cache ou erros.

Campos públicos que o frontend precisa renderizar: `id`, `title`, `category`, `type`, `price`, `bedrooms`, `baths`, `area`, `province`, `municipality`, `neighborhood`, `image`, `photos`, `video`, `description`, `amenities`, `agent`, `status`. Se os nomes/formatos retornados diferirem, documenta e fornece um resource/adapter consistente.

O frontend desenha um mapa de demonstração usando `pin: [x, y]` como percentagens, não coordenadas geográficas. Não inventes essas coordenadas como localização real. Se for necessário fornecer `pin` para compatibilidade, deve ser um valor visual aproximado explicitamente separado das coordenadas privadas.

### 5. Favoritos

Favoritos devem ser associados ao utilizador autenticado e ser idempotentes. `POST /properties/{id}/favorite` deve adicionar/remover de forma documentada; escolhe uma semântica clara e garante que repetir a chamada não corrompe o estado. `GET /favorites` devolve os imóveis favoritados. Se visitantes anónimos forem suportados no frontend, não os uses como autorização para dados privados.

### 6. Vínculos com intermediários

Implementa:

- `POST /properties/{id}/agents`
- `GET /agent-links`
- `PATCH /agent-links/{id}`

Convite recebe:

```json
{
  "agent_email": "agente@example.com",
  "commission_pct": 5,
  "terms": "Condições acordadas"
}
```

O proprietário/publicador cria vínculo pendente. O intermediário pode aceitar (`approved`) ou recusar (`rejected`); o proprietário pode revogar (`revoked`). Mantém também o estado `pending`. O máximo é cinco vínculos `pending` + `approved` por imóvel. Bloqueia convites duplicados, auto-vínculo e utilizadores que não sejam intermediários. Gera no servidor um `tracking_code` único. Mantém registo temporal de quem alterou estado.

`PATCH /agent-links/{id}` recebe `{ "status": "approved" }`, `rejected` ou `revoked`, mas a autorização deve limitar quais atores podem efetuar cada transição.

### 7. Disponibilidade, visitas e check-in

Implementa:

- `GET /availability`
- `PUT /availability`
- `GET /visits`
- `POST /visits`
- `POST /visits/checkin`

Disponibilidade:

```json
{
  "days": [1, 2, 3, 4, 5],
  "start": "09:00",
  "end": "17:00",
  "slot": 60
}
```

Padroniza os dias da semana. Há uma divergência existente: `docs/API.md` diz `1=segunda` a `7=domingo`, enquanto o formulário em `roles.js` envia domingo como `0`. Escolhe uma convenção, documenta-a e reporta que o frontend terá de ser ajustado se necessário.

Criar visita recebe:

```json
{
  "property_id": 123,
  "scheduled_at": "2026-12-01T10:30:00+01:00",
  "payment_method": "mcx_express"
}
```

`payment_method` pode ser `mcx_express` ou `reference`. O preço da visita é calculado no servidor usando configurações. Verifica imóvel ativo, disponibilidade e conflito de horário. Reserva o slot por 30 minutos enquanto se aguarda pagamento, usando transação/lock para impedir duas reservas concorrentes. Cria visita com pagamento pendente e devolve instruções de pagamento. Não gera confirmação de pagamento nem desbloqueia morada no pedido do cliente.

Após confirmação GPO, marca a visita como paga, gera código aleatório único `INT-xxxx`, e permite que cliente, proprietário e intermediário autorizado vejam os dados que lhes cabem. O código não pode ser reutilizado. `POST /visits/checkin` recebe `{ "code": "INT-8492" }`; só o intermediário associado pode validar e concluir a visita paga. Regista `checked_in_at` e estado `completed`.

### 8. Pagamentos EMIS GPO

Implementa endpoint de webhook:

- `POST /payments/emis/webhook`

O webhook deve:

- Verificar assinatura/autenticidade segundo a integração EMIS configurada; credenciais apenas em variáveis de ambiente/secret manager.
- Ser idempotente por identificador do evento/transação.
- Validar referência, montante, moeda e entidade da transação contra o registo local.
- Atualizar estado de pagamento e iniciar os efeitos de negócio numa transação.
- Nunca confiar em parâmetros de retorno do browser ou em estado enviado pelo frontend.
- Registar auditoria sem guardar dados sensíveis desnecessários.
- Tratar eventos duplicados, inválidos e fora de ordem.

Se as credenciais EMIS não estiverem disponíveis durante o desenvolvimento, cria uma interface de gateway e um fake gateway disponível apenas em ambiente local/teste. Não exponhas rota pública que permita a um utilizador comum marcar pagamentos como confirmados.

### 9. Arrendamentos e comissões

Implementa:

- `GET /rentals`
- `POST /rentals`
- `GET /commissions`
- `PATCH /commissions/{id}/pay`

Pedido de arrendamento:

```json
{
  "property_id": 123,
  "tenant": "João Manuel",
  "phone": "+244 923 000 001",
  "nif": "987654321",
  "start_date": "2026-12-01",
  "duration_months": 12,
  "payment_method": "mcx_express"
}
```

O backend calcula mensalidade, percentagem/valor de comissão da plataforma e total. Não aceite totais ou percentagens como autoridade vindos do browser. Cria arrendamento e pagamento pendentes; disponibiliza instruções de GPO. Só webhook válido e confirmado pode gerar/ativar o contrato, registar transação, marcar imóvel como `rented` conforme regra de produto e criar comissão devida ao intermediário.

O arrendatário paga primeiro mês + comissão da plataforma. Comissão do intermediário é devida pelo proprietário e não deve ser adicionada ao total do arrendatário. Contrato deve conter número único, partes, imóvel, início, duração, valores, comprovativo/referência e estado. Não declares que o contrato constitui aconselhamento jurídico; documenta a necessidade de validação legal local.

`GET /rentals` e `/commissions` devem filtrar por permissões: arrendatário, proprietário, intermediário e administrador veem apenas os registos autorizados. Pagamento da comissão do proprietário deve iniciar fluxo de pagamento e só transitar a `paid` após confirmação. Não permita ao cliente marcar comissões pagas.

### 10. Pedidos da comunidade

Implementa:

- `GET /community/requests`
- `POST /community/requests`
- `POST /community/requests/{id}/offers`
- `PATCH /community/requests/{id}/close`

Criar pedido recebe:

```json
{
  "category": "rent",
  "tipologia": "T2",
  "municipality": "Talatona",
  "neighborhood": "Benfica",
  "budget": 250000,
  "message": "Procuro apartamento com estacionamento."
}
```

Estados: `open`, `closed`. Só cliente autenticado pode publicar/fechar o próprio pedido. Notifica profissionais com imóvel ativo elegível no mesmo município e tipologia; categoria deve coincidir, exceto categoria `all` caso seja suportada. O bairro e orçamento devem ser tratados como filtros/regras claramente documentados.

Resposta de profissional:

```json
{
  "property_id": 123,
  "accept": true
}
```

`accept: false` regista recusa/ignorar. Cada proprietário/intermediário responde independentemente por imóvel elegível. Impede duplicação de resposta, resposta por profissional sem vínculo aprovado, resposta a pedido fechado ou por imóvel inativo. Notifica o cliente de cada resposta aceite.

### 11. Notificações e administração

Notificações:

- `GET /notifications`
- `PATCH /notifications/{id}/read`
- `POST /notifications/read-all`

Inclui paginação, timestamps, estado de leitura e autorização por dono da notificação. Polling a cada 30–60 segundos é suficiente para a primeira versão; deixa push/tempo real fora do escopo se não for necessário.

Admin:

- `GET /admin/stats`
- `GET /admin/users`
- `PATCH /admin/users/{id}`
- `GET /admin/payments`
- `GET /admin/properties`
- `PATCH /admin/properties/{id}`
- `GET /admin/settings`
- `PUT /admin/settings`

Admin pode rever/verificar utilizadores e imóveis, consultar pagamentos e gerir definições como `visit_fee`, `platform_commission_pct` e `agent_commission_pct`. Valida limites e regista auditoria de alterações. Todas as rotas admin exigem papel `admin` verificado pelo servidor.

### 12. Modelo de dados sugerido

Cria migrations e relações para, pelo menos:

- `users`: papel, estado, dados de contacto, hash de password; referências privadas a documentos.
- `properties`: publicador/dono, dados públicos, morada e coordenadas privadas, preço, estado, motivo de rejeição.
- `property_media`: tipo, caminho, ordenação, capa.
- `agent_links`: propriedade, dono, intermediário, estado, termos, percentagem acordada e tracking code.
- `availabilities`: utilizador/intermediário, dias, faixa horária e slot.
- `favorites`: utilizador e propriedade, unique constraint.
- `visits`: utilizador, propriedade, intermediário, slot, estado, código e check-in.
- `payments`: entidade associada, gateway, referência externa, valor, moeda, estado, payload mínimo/auditável e idempotency key.
- `rentals`/`contracts`: partes, imóvel, prazo, renda, comissão da plataforma, pagamento e documento/estado.
- `commissions`: proprietário, intermediário, arrendamento, valor, percentagem e pagamento.
- `community_requests` e `community_offers`.
- `notifications`.
- `settings`.
- Tabela de auditoria/eventos de webhook se apropriado.

Usa foreign keys, índices e constraints para impedir duplicações e concorrência indevida. Define soft delete apenas onde fizer sentido e não apagues dados financeiros/auditáveis.

### 13. Compatibilidade específica com o frontend

`api.js` já define os métodos e caminhos acima e interpreta `message`, `errors` e `code`. A API `properties.create` envia `FormData`; auth register também pode enviar `FormData`. A implementação deve ser consistente com esse wrapper.

Contudo, as páginas atuais ainda usam `localStorage` diretamente e `config.js` mantém `USE_API: false`. Não declares a integração frontend concluída por apenas criar endpoints. No final:

1. Confirma quais chamadas são exercitadas pelo frontend atual e quais ainda requerem alteração do frontend.
2. Se esta tarefa incluir integrar o frontend, altera apenas os fluxos diretamente relacionados para usar `Api.*`, mantendo a experiência existente e tratando loading/erros/estado pendente de pagamento.
3. Não alteres `USE_API` para produção nem inventes URL real. Mantém configuração por ambiente.
4. Não migres automaticamente dados locais para o backend sem pedir/definir uma estratégia explícita.
5. Documenta incompatibilidades, particularmente dias de disponibilidade, formatos de respostas e campo de mídia.

### 14. Testes obrigatórios

Cria testes Feature cobrindo pelo menos:

- Registo/login, token, logout e acesso sem autenticação.
- Tentativa de criar conta admin por registo público.
- Pedido e verificação de OTP, código inválido/expirado, ID de verificação alheio ou já consumido, e bloqueio de registo sem verificação válida.
- Autorização por papel e isolamento de dados entre utilizadores.
- Upload de menos de 5 fotos, upload válido e arquivo inválido.
- Duplicado de imóvel e ocultação de morada exacta na API pública.
- Aprovação/rejeição administrativa.
- Limite de cinco intermediários, convite duplicado e transições de estado inválidas.
- Conflito de slot de visita e reserva concorrente quando viável nos testes.
- Pagamento não confirmado não gera código, contrato ou morada desbloqueada.
- Webhook assinado, inválido e repetido/idempotente.
- Check-in por intermediário autorizado, código inválido/reutilizado e visita não paga.
- Cálculo do total de arrendamento e comissão, com comissão do intermediário fora do valor do arrendatário.
- Resposta à comunidade apenas por profissional autorizado e pedido aberto.
- Rotas admin negadas a não administradores.
- Validação de payloads e formato consistente de erros.

Usa fakes/mocks de gateway de pagamento e storage nos testes. Não acedas a serviços financeiros reais.

### 15. Entrega e verificação

Ao terminar, apresenta:

1. Resumo da arquitetura e decisões.
2. Ficheiros/rotas implementados.
3. Comandos exatos para instalar, configurar `.env`, migrar, semear dados de desenvolvimento e iniciar.
4. Como configurar CORS, storage e credenciais EMIS fora do repositório.
5. Como executar testes e os resultados observados.
6. Exemplo de chamada cURL para login, criação de imóvel e criação de visita.
7. Lista clara do que continua dependente de alterações no frontend ou de credenciais/aprovação da EMIS.

Executa migrations e testes no ambiente disponível. Corrige falhas introduzidas pela implementação. Não afirmes que EMIS, pagamentos reais ou validações legais estão operacionais sem credenciais e testes de integração apropriados.

---
