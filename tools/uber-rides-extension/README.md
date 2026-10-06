# Capturas — Uber & dōTERRA — extensão do Chrome

Extensão do Chrome **para uso pessoal** (não publicada na Chrome Web Store) que
faz a captura de duas fontes e entrega um JSON ao Controle de Recebíveis:

1. **Corridas Uber** — roda na sua própria sessão do Uber, coleta as corridas
   dos perfis **pessoal** e **família** (o mesmo que o script do Tampermonkey
   [`../uber-rides/uber-rides.user.js`](../uber-rides/uber-rides.user.js) faz).
2. **Pedidos dōTERRA** — roda no Back Office do dōTERRA
   (`Rastreamento de Pedidos e Pacotes`) e captura os pedidos da tabela,
   buscando o detalhe de cada um.

Em ambos os casos o JSON chega ao app de duas maneiras:

1. **Enviar para o app** (botão dedicado): a extensão chama o endpoint do seu
   backend usando um token de API gerado no app e abre a tela correspondente em
   uma nova aba (Finanças para as corridas, Pedidos para os pedidos dōTERRA).
2. **Copiar JSON** (fallback, sempre disponível): copia o JSON para que você
   cole na tela de importação (Finanças → "Importar corridas" ou Pedidos →
   "Importar pedidos").

Os dois caminhos coexistem dentro de cada caixa flutuante — se o envio falhar
(rede, token), o JSON é copiado automaticamente para você não perder a captura.

Nenhuma credencial do Uber sai do navegador: o `fetch` da captura roda no
contexto da página, então o cookie de sessão (HttpOnly) é enviado
naturalmente pelo navegador. Para o app, a extensão usa o token de API salvo
(arquivo `chrome.storage.local`, privado do navegador).

## Arquivos

```text
manifest.json                 Manifesto MV3 (3 content scripts + service worker)
src/page/content.js           Uber, mundo MAIN — gancho em fetch/XHR + coleta GraphQL
src/ui/content.js             Uber, mundo ISOLATED — UI, storage, clipboard, popup bridge
src/doterra/content.js        dōTERRA, mundo ISOLATED — leitura da tabela + detalhe
src/background/background.js  Service worker — envios ao app + abertura das abas
src/popup/popup.html          Popup da barra de ferramentas (status + token/servidor)
src/popup/popup.js            Lógica do popup
icons/{16,48,128}.png         Ícones
```

Cada componente é um **arquivo único e autocontido**. Isso é intencional:
elimina qualquer dependência de ordem de injeção ou de um namespace global
compartilhado — a causa de uma classe de bug que apareceu durante o
desenvolvimento. Não divida esses arquivos sem revalidar o carregamento no
navegador. O script do dōTERRA roda apenas no mundo ISOLATED (ele lê o DOM; não
precisa interceptar rede).

## Instalação (modo desenvolvedor)

Como a extensão não está na Chrome Web Store, o Chrome exige o **Modo do
desenvolvedor**. Há dois caminhos:

**a) Pelo app (recomendado).** Em Finanças → "Importar corridas" →
"Como capturar?", clique em **Baixar extensão (ZIP)**, descompacte o arquivo em
uma pasta e aponte o Chrome para ela (passos abaixo). O app gera o ZIP a partir
desta pasta no `dev`/`build` do frontend, então ele sempre reflete o código
atual.

**b) Direto desta pasta.** Se você tem o repositório, carregue
`tools/uber-rides-extension/` mesmo.

1. Abra `chrome://extensions/`.
2. Ative o **Modo do desenvolvedor** (canto superior direito).
3. Clique em **Carregar sem compactação** e selecione a pasta da extensão
   (a descompactada do ZIP ou `tools/uber-rides-extension/`).
4. A extensão fica instalada e sobrevive a reinícios do Chrome.

> Não é necessário publicar nem pagar nada.
>
> **Ao mudar o `manifest.json`** (versão, nomes de arquivo, permissões), o
> botão *Atualizar* do cartão **não** relê o manifesto em algumas versões do
> Chrome. Nesse caso, **remova** a extensão e **carregue sem compactação**
> de novo. Ao mudar apenas o conteúdo dos arquivos já listados, basta
> *Atualizar* + recarregar a aba com Ctrl+Shift+R.

## Configurar o envio para o app (uma vez)

1. No Controle de Recebíveis, abra **Finanças → "Importar corridas"** (ou
   **Pedidos → "Importar pedidos"**). Na primeira vez aparece o modal de
   orientação, com o passo a passo e o botão **"Gerar token para a extensão"**
   (escolha o nome e a validade; o padrão são 30 dias). O token tem forma
   `cr_…`, é exibido **uma única vez** e caduca conforme o prazo escolhido
   (7/30/90 dias).
2. Marque os **escopos** que o token deve valer: **Corridas Uber
   (uber:import)** e **Pedidos dōTERRA (doterra:import)** já vêm marcados — um
   único token cobre as duas capturas.
3. Abra o popup da extensão (ícone na barra do Chrome) e cole o token em
   **Token de acesso**.
4. Em **Servidor do app**, confirme o endereço (padrão
   `http://localhost:3000`; em produção use o endereço do app) e clique
   **Salvar**.
5. O botão **Abrir o app para gerar o token** do popup abre `Finanças` com o
   modal de importação já aberto, para você gerar/regenerar o token quando
   precisar.

Trocado o token salvo, o botão **Enviar para o Controle de Recebíveis** da
caixa flutuante fica liberado (abaixo dele aparece "Token salvo (termina em
1234)").

> O servidor precisa estar acessível a partir do Chrome (o `host_permissions`
> do manifesto cobre `localhost:3000` e `localhost:4000`). A chamada parte do
> **service worker** da extensão, por isso não depende de CORS do backend.
> Se o envio falhar, o status da caixa flutuante aponta o motivo (token,
> rede ou HTTP) e o JSON é copiado para colar no app.

## Uso

1. Abra <https://riders.uber.com/> e faça login (a extensão precisa estar
   ativa antes da página carregar; por isso `run_at: document_start`).
2. A caixa **Corridas Uber** aparece no canto inferior direito, com a versão e
   o rótulo de build no topo (ex.: `v0.6.0 · doterra-orders`).
3. Ajuste **Início** e **Fim**. A janela deve cobrir o ciclo de fatura com
   folga — a data do lançamento no cartão costuma ser 1 a 3 dias depois da
   corrida. O padrão é hoje até 35 dias atrás.
4. Escolha como entregar as corridas:
   - **Enviar para o Controle de Recebíveis**: captura e envia direto ao
     backend, abrindo a tela de Finanças em nova aba com as corridas visíveis
     (o mesmo resultado de importar pela própria tela). Precisa de um token
     salvo no popup; sem ele, o botão fica desabilitado e o status avisa.
   - **Capturar e copiar JSON**: captura e copia; cole em Finanças →
     "Importar corridas".
5. De tanto em tanto, gere um novo token no app quando o atual expirar (o
   status do envio avisa a expiração).

As últimas datas usadas são lembradas e pré-preenchidas na próxima vez.

Se o aviso *"Aguardando uma chamada do Uber…"* aparecer, apenas recarregue a
página de corridas do Uber: a extensão precisa observar uma chamada real da
página para reaproveitar os headers exigidos pela API.

### Diagnóstico rápido

Ao abrir `riders.uber.com` com a extensão ativa, o console (F12) deve mostrar
**duas** linhas com o mesmo rótulo de build:

```text
[Uber Rides Capture] MAIN v0.6.0 (doterra-orders) carregado em …
[Uber Rides Capture] ISOLATED v0.6.0 (doterra-orders) carregado em …
```

Em `office.doterra.com`, a linha correspondente é:

```text
[Doterra Orders Capture] ISOLATED v0.6.0 (doterra-orders) carregado em …
```

Se faltar uma delas (ou nenhuma), remova e re-adicione a extensão. O rótulo de
build também aparece na caixa flutuante e no popup, para confirmar visualmente
que o Chrome carregou o build novo.

### Popup da barra de ferramentas

Clique no ícone da extensão na barra do Chrome para:

- ver se a sessão do Uber já foi detectada na aba ativa;
- **Capturar agora** — dispara a mesma captura sem usar a caixa flutuante;
- configurar o **token** e o **servidor do app** para o fluxo de envio;
- **Abrir o app para gerar o token** — abre Finanças com o modal de importação;
- **Abrir riders.uber.com** — abre a página de corridas em uma nova aba.

## Formato do JSON gerado

Idêntico ao do userscript — veja
[`../uber-rides/README.md`](../uber-rides/README.md) para o exemplo completo e a
descrição de como o backend deriva valor, familiar, status, data/hora, destino
e tipo de cada corrida.

O envio para o app envolve o mesmo JSON dentro de:

```jsonc
{
  "source": "UBER_SESSION",
  "json": "<mesmo JSON salvo>",
  "windowStart": "derived das datas início/fim",
  "windowEnd": "derived das datas início/fim"
}
```

## Observações técnicas

- A extensão usa **dois content scripts**, um por mundo:
  - **MAIN** (`src/page/content.js`) — equivalente ao `@grant none` do
    userscript. Roda no contexto da página para interceptar
    `window.fetch`/`XMLHttpRequest` antes do bundle do Uber. Sem
    `"world": "MAIN"` o gancho não vê as chamadas do site e a captura falha.
  - **ISOLATED** (`src/ui/content.js`) — dono da UI, do `chrome.storage.local`,
    da área de transferência e da conversa com o popup e o background.
- Os mundos se comunicam por `window.postMessage` com uma marca própria
  (`uber-rides-capture`).
- **O envio ao app** acontece no **service worker**
  (`src/background/background.js`): contexts de extensão atendem a
  `host_permissions`, então a chamada não passa por CORS da página e o
  content script nunca manipula o token.
- A API `POST https://riders.uber.com/graphql` (operação `Activities`) exige o
  header `x-csrf-token`, calculado dentro do bundle da página. A extensão
  observa a chamada da própria página e reaproveita os headers capturados.
- Permissões: `clipboardWrite` (copiar o JSON) e `storage` (lembrar as datas e
  as credenciais de integração). `host_permissions` cobre
  `https://riders.uber.com/*` e os possíveis endereços do backend local
  (`http://localhost:3000/*`, `http://localhost:4000/*`).
- O token de app é lido pelo service worker, não pela página — a página que a
  extensão roda (a do Uber) nunca o vê.

## Pedidos dōTERRA

1. Abra <https://office.doterra.com/> e faça login.
2. Acesse **Rastreamento de Pedidos e Pacotes**
   (`evo_Modules.OrderHistoryFull`). A caixa **Pedidos dōTERRA** aparece no canto
   inferior direito, com a versão e o rótulo de build no topo.
3. A caixa mostra quantos pedidos estão na tabela. Pedidos com link
   **Cancelar** (não pagos) são ignorados automaticamente.
4. **Carregar mais antigos** pagina a própria tabela (o mesmo "Ver mais" da
   página), acumulando os pedidos mais antigos.
5. **Importar novos pedidos**: consulta quais pedidos o app ainda não tem
   (apenas os números novos têm o detalhe buscado, um a um), envia e abre
   `Pedidos` com os pedidos importados marcados como **"Pendente de revisão"**.
   No app, revise cada pedido; códigos desconhecidos viram produtos
   **"Pendente de cadastro"** que você completa e ativa na tela de Produtos.
   Se algum pedido falhar, o status mostra o motivo da primeira falha e o log
   da caixa lista cada uma (número do pedido + causa: parsing, validação ou
   erro do app).
6. **Capturar e copiar JSON**: gera o mesmo JSON e copia, para você colar em
   Pedidos → **"Importar pedidos"** (caminho manual, sem token).

Ao excluir um pedido importado, o app remove junto o que a importação criou:
movimentos de estoque, lançamentos financeiros (e fatura, no cartão) e os
produtos rascunho que ninguém mais usa.

## Limitações

- O endpoint do Uber é privado e não documentado; a Uber pode alterá-lo sem
  aviso. Se a captura quebrar, ainda é possível colar um JSON no formato acima
  manualmente.
- A extensão não publica nada, não contorna proteção de automação e não roda
  em segundo plano além do listener de mensagem do service worker.
- Requer Chrome 111+ (por causa de `"world": "MAIN"` nos content scripts).
