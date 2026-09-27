# Corridas Uber — extensão do Chrome

Extensão do Chrome **para uso pessoal** (não publicada na Chrome Web Store) que
faz exatamente o que o script do Tampermonkey
([`../uber-rides/uber-rides.user.js`](../uber-rides/uber-rides.user.js)) faz:
roda na sua própria sessão do Uber, coleta as corridas dos perfis **pessoal** e
**família** e copia um JSON que você cola na tela **Corridas** do Controle de
Recebíveis.

Os dois caminhos coexistem: o userscript continua sendo uma alternativa válida.

Nenhuma credencial sai do navegador: o `fetch` roda no contexto da página, então
o cookie de sessão (HttpOnly) é enviado naturalmente pelo navegador. Nada é
gravado no sistema além do JSON reduzido que você cola.

## Arquivos

```text
manifest.json              Manifesto MV3 (dois content scripts, um por mundo)
src/page/content.js        Mundo MAIN — gancho em fetch/XHR + coleta GraphQL
src/ui/content.js          Mundo ISOLATED — UI, storage, clipboard, popup bridge
src/popup/popup.html       Popup da barra de ferramentas
src/popup/popup.js         Lógica do popup
scripts/make-icons.mjs     Gerador dos ícones (sem dependências externas)
icons/{16,48,128}.png      Ícones
```

Cada um dos dois content scripts é um **arquivo único e autocontido**. Isso é
intencional: elimina qualquer dependência de ordem de injeção ou de um namespace
global compartilhado entre scripts — a causa de uma classe de bug que apareceu
durante o desenvolvimento desta extensão. Não divida esses arquivos sem
revalidar o carregamento no navegador.

## Instalação (modo desenvolvedor)

1. Abra `chrome://extensions/`.
2. Ative o **Modo do desenvolvedor** (canto superior direito).
3. Clique em **Carregar sem compactação** e selecione esta pasta
   (`tools/uber-rides-extension/`).
4. A extensão fica instalada e sobrevive a reinícios do Chrome.

> Não é necessário publicar nem pagar nada.
>
> **Ao mudar o `manifest.json`** (versão, nomes de arquivo, permissões), o botão
> *Atualizar* do cartão **não** relê o manifesto em algumas versões do Chrome.
> Nesse caso, **remova** a extensão e **carregue sem compactação** de novo. Ao
> mudar apenas o conteúdo dos arquivos já listados, basta *Atualizar* + recarregar
> a aba com Ctrl+Shift+R.

## Uso

1. Abra <https://riders.uber.com/> e faça login (a extensão precisa estar ativa
   antes da página carregar; por isso `run_at: document_start`).
2. A caixa **Corridas Uber** aparece no canto inferior direito, com a versão e o
   rótulo de build no topo (ex.: `v0.3.0 · self-contained`).
3. Ajuste **Início** e **Fim**. A janela deve cobrir o ciclo de fatura com
   folga — a data do lançamento no cartão costuma ser 1 a 3 dias depois da
   corrida. O padrão é hoje até 35 dias atrás.
4. Clique em **Capturar e copiar JSON**.
5. Cole na tela **Corridas** do Controle de Recebíveis.

As últimas datas usadas são lembradas e pré-preenchidas na próxima vez.

Se o aviso *"Aguardando uma chamada do Uber…"* aparecer, apenas recarregue a
página de corridas do Uber: a extensão precisa observar uma chamada real da
página para reaproveitar os headers exigidos pela API.

### Diagnóstico rápido

Ao abrir `riders.uber.com` com a extensão ativa, o console (F12) deve mostrar
**duas** linhas com o mesmo rótulo de build:

```text
[Uber Rides Capture] MAIN v0.3.0 (self-contained) carregado em …
[Uber Rides Capture] ISOLATED v0.3.0 (self-contained) carregado em …
```

Se faltar uma delas (ou nenhuma), remova e re-adicione a extensão. O rótulo de
build também aparece na caixa flutuante e no popup, para confirmar visualmente
que o Chrome carregou o build novo.

### Popup da barra de ferramentas

Clique no ícone da extensão na barra do Chrome para:

- ver se a sessão do Uber já foi detectada na aba ativa;
- **Capturar agora** — dispara a mesma captura sem usar a caixa flutuante;
- **Abrir riders.uber.com** — abre a página de corridas em uma nova aba.

## Formato do JSON gerado

Idêntico ao do userscript — veja
[`../uber-rides/README.md`](../uber-rides/README.md) para o exemplo completo e a
descrição de como o backend deriva valor, familiar, status, data/hora, destino e
tipo de cada corrida.

## Observações técnicas

- A extensão usa **dois content scripts**, um por mundo:
  - **MAIN** (`src/page/content.js`) — equivalente ao `@grant none` do
    userscript. Roda no contexto da página para interceptar
    `window.fetch`/`XMLHttpRequest` antes do bundle do Uber. Sem
    `"world": "MAIN"` o gancho não vê as chamadas do site e a captura falha.
  - **ISOLATED** (`src/ui/content.js`) — dono da UI, do `chrome.storage.local`,
    da área de transferência e da conversa com o popup.
- Os dois mundos se comunicam por `window.postMessage` com uma marca própria
  (`uber-rides-capture`).
- A API `POST https://riders.uber.com/graphql` (operação `Activities`) exige o
  header `x-csrf-token`, calculado dentro do bundle da página. A extensão observa
  a chamada da própria página e reaproveita os headers capturados.
- Permissões: `clipboardWrite` (copiar o JSON) e `storage` (lembrar as datas).
  `host_permissions` cobre apenas `https://riders.uber.com/*`.
- Não há service worker: nada roda em segundo plano. A extensão age somente
  quando você clica no botão (na caixa flutuante ou no popup).

## Limitações

- O endpoint é privado e não documentado; a Uber pode alterá-lo sem aviso. Se a
  captura quebrar, ainda é possível colar um JSON no formato acima manualmente.
- A extensão não publica nada, não contorna proteção de automação e não roda em
  segundo plano.
- Requer Chrome 111+ (por causa de `"world": "MAIN"` nos content scripts).
