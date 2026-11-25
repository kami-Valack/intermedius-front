# Intermediárius

Marketplace de imóveis para Angola (PWA estática): explorar, favoritos, visitas pagas, arrendamento, comunidade de pedidos e áreas de cliente, proprietário, intermediário e administrador.

> **Estado:** demonstração. Dados em `localStorage`, pagamentos simulados. Para operar é preciso backend (ver `docs/API.md`).

## Estrutura
| Ficheiro | Função |
|---|---|
| `index.html` | Página única |
| `app.js` | Catálogo, pesquisa, favoritos, detalhe e visitas |
| `roles.js` | Contas, áreas por papel, cadastro de imóveis, intermediários (máx. 5), moderação |
| `rentals.js` | Arrendamento, contratos e comissões |
| `community.js` | Fotos/vídeo do anúncio, pedidos da comunidade e notificações |
| `config.js` / `api.js` | Configuração e camada de API (ponto único de integração) |
| `sw.js`, `manifest.webmanifest` | PWA offline/instalável |

## Correr localmente
```bash
python3 -m http.server 8080   # abrir http://localhost:8080
```
(Use um servidor; abrir o `index.html` diretamente não regista o service worker.)

## Subir ao GitHub
```bash
git init && git add . && git commit -m "Intermediárius: versão inicial"
git branch -M main
git remote add origin https://github.com/SEU_USUARIO/intermediarius.git
git push -u origin main
```
No GitHub: **Settings → Pages → Source: GitHub Actions**. O workflow `.github/workflows/pages.yml` publica a cada push.
Ao alterar ficheiros em cache, aumente a versão em `sw.js` (`intermediarius-vN`).

## Integrar a API (backend Laravel: `intermediarius-api-laravel.zip`)
Guia completo em `docs/FRONTEND.md`.
1. Instale o backend Laravel (ou construa outro segundo `docs/API.md`).
2. Em `config.js`: `USE_API: true` e `API_BASE_URL`.
3. Troque `load()/save()/localStorage` por chamadas `Api.*` (`api.js`), ficheiro a ficheiro. Comece por contas e imóveis.

## Antes de operar
- Autenticação e palavras-passe no servidor; hoje não há segurança real.
- Fotos/vídeo em storage (S3/R2), não em base64.
- EMIS GPO real com webhook assinado; contratos só após confirmação.
- Morada exata e contactos só no servidor, após visita paga.
- Validação de BI/NIF, termos de uso, política de privacidade e conformidade legal em Angola.
