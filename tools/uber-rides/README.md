# Corridas Uber — captura (Tampermonkey)

Script de captura da lista de corridas do Uber. Ele roda na sua própria sessão
do Uber, coleta as corridas dos perfis **pessoal** e **família** e copia um JSON
que você cola na tela **Corridas** do Controle de Recebíveis.

Nenhuma credencial sai do navegador: o `fetch` roda no contexto da página, então
o cookie de sessão (HttpOnly) é enviado naturalmente pelo navegador. Nada é
gravado no sistema além do JSON reduzido que você cola.

## Arquivos

- `uber-rides.user.js` — script para o Tampermonkey.

## Instalação

1. Instale a extensão [Tampermonkey](https://www.tampermonkey.net/).
2. Abra o painel do Tampermonkey → **Criar um novo script**.
3. Apague o conteúdo de exemplo e cole todo o conteúdo de `uber-rides.user.js`.
4. Salve (Ctrl+S).

## Uso

1. Abra <https://riders.uber.com/> e faça login (o script precisa estar ativo
   antes da página carregar; por isso `@run-at document-start`).
2. A caixa **Corridas Uber** aparece no canto inferior direito.
3. Ajuste **Início** e **Fim**. A janela deve cobrir o ciclo de fatura com
   folga — a data do lançamento no cartão costuma ser 1 a 3 dias depois da
   corrida. O padrão é hoje até 35 dias atrás.
4. Clique em **Capturar e copiar JSON**.
5. Cole na tela **Corridas** do Controle de Recebíveis.

Se o aviso *"Sessão não detectada"* aparecer, apenas recarregue a página de
corridas do Uber e tente novamente: o script precisa observar uma chamada real
da página para reaproveitar os headers exigidos pela API.

## Formato do JSON gerado

```jsonc
{
  "source": "UBER_SESSION",
  "utcOffsetMinutes": -180,
  "windowStart": "2026-08-23T03:00:00.000Z",
  "windowEnd": "2026-09-27T02:59:59.999Z",
  "profiles": {
    "PERSONAL": {
      "total": 0,
      "corridas": 0,
      "canceladas": 0,
      "atividades": []
    },
    "FAMILY": {
      "total": 31,
      "corridas": 29,
      "canceladas": 2,
      "atividades": [
        {
          "uuid": "0a6ea135-cb1c-48ac-9b53-82315bf1935b",
          "cardURL": "https://riders.uber.com/trips/0a6ea135-...",
          "description": "R$32,93 • Cássia",
          "subtitle": "26 de set. • 13:02",
          "title": "Duo Residence Mall",
          "imageURL": "https://d1a3f4spazzrp4.cloudfront.net/car-types/haloProductImages/Regular/MotorcycleCourier-037-0.png"
        }
      ]
    }
  }
}
```

O backend deriva, de cada atividade:

- **valor** em centavos, a partir de `description` (`R$32,93` → `3293`);
- **familiar** como o último segmento de `description` que não é valor nem
  status (`Cancelada` → ignora, sobra `Cássia`);
- **status** `CANCELLED` quando algum segmento contém "cancelad";
- **data/hora** a partir de `subtitle` (pt-BR, sem ano). O ano é inferido pela
  janela (`windowStart`/`windowEnd`);
- **destino** a partir de `title`;
- **tipo** a partir do `imageURL`: assets de courier/moto → `DELIVERY` (entrega);
  assets de carro (`car-types/haloProductImages`) → `RIDE` (passageiro). Quando o
  Uber devolve o **mapa da rota** (`static-maps.uber.com`, na corrida destacada)
  ou não há imagem, o tipo fica `UNKNOWN` (não identificado).

O horário da corrida é mantido como o **relógio local** do momento da corrida
(o `subtitle`), sem conversão de fuso — por isso ele aparece exatamente como no
Uber, independentemente do fuso do servidor. O campo `utcOffsetMinutes`
(offset do navegador, ex.: `-180` para UTC-3) é usado apenas para alinhar a
janela de datas com o relógio local; se o JSON não trouxer esse campo, o padrão
é `-180` (horário de Brasília).

Corridas canceladas são importadas, mas não podem ser lançadas automaticamente
(algumas praças cobram taxa de cancelamento; nesse caso o lançamento é manual).

## Observações técnicas

- `@grant none` é **obrigatório**. Com qualquer `@grant`, o script sai do
  contexto da página e o gancho em `window.fetch`/`XMLHttpRequest` deixa de ver
  as chamadas feitas pelo site.
- A API `POST https://riders.uber.com/graphql` (operação `Activities`) exige o
  header `x-csrf-token`, calculado dentro do bundle da página. O script observa
  a chamada da própria página e reaproveita os headers capturados.
- O endpoint é privado e não documentado; a Uber pode alterá-lo sem aviso. Se a
  captura quebrar, ainda é possível colar um JSON no formato acima manualmente.
- O script **não** publica nada, **não** contorna proteção de automação e
  **não** roda em segundo plano: ele age somente quando você clica no botão.
