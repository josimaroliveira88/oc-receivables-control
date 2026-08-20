# Modelo de Dados

Diagrama do modelo de dados da aplicação (PostgreSQL via Prisma), com isolamento por usuário e relacionamentos financeiros.

```mermaid
erDiagram
    User {
        String id PK
        String username UK
        String password
        DateTime createdAt
        DateTime updatedAt
    }

    Person {
        String id PK
        String name
        String whatsapp
        String commonGroups
        String instagram
        String address
        Boolean isVip
        Boolean isDoterraMember
        String userId FK
        DateTime createdAt
        DateTime updatedAt
    }

    Order {
        String id PK
        String orderNumber
        Decimal totalValue
        DateTime orderDate
        OrderStatus status
        String accountOwner
        PaymentType paymentType
        String orderNotes
        String userId FK
        DateTime createdAt
        DateTime updatedAt
    }

    Item {
        String id PK
        String description
        Decimal chargedValue
        Decimal memberPrice
        Decimal pv
        String details
        String productId FK
        String orderId FK
        String personId FK
        DateTime createdAt
        DateTime updatedAt
    }

    Payment {
        String id PK
        Decimal amount
        DateTime paidAt
        String notes
        String orderId FK
        String personId FK
        DateTime createdAt
        DateTime updatedAt
    }

    Product {
        String id PK
        String code UK
        String name
        String size
        ProductStatus status
        String doterraUrl
        DateTime createdAt
        DateTime updatedAt
    }

    ProductPrice {
        String id PK
        String productId FK
        Decimal regularPrice
        Decimal memberPrice
        Decimal pv
        DateTime validFrom
        DateTime validTo
        DateTime createdAt
    }

    User ||--o{ Person : "possui"
    User ||--o{ Order : "possui"
    Person ||--o{ Item : "compra (opcional)"
    Person ||--o{ Payment : "recebe (opcional)"
    Order ||--o{ Item : "contem"
    Order ||--o{ Payment : "recebe"
    Product ||--o{ Item : "referencia (opcional)"
    Product ||--o{ ProductPrice : "historico de precos"
```

## Enums

### `OrderStatus`

| Valor      | Significado                                     |
| ---------- | ----------------------------------------------- |
| `PENDENTE` | Pedido sem nenhum pagamento registrado.         |
| `PARCIAL`  | Pedido com pagamento(s) cobrindo parte do total.|
| `QUITADO`  | Pedido totalmente pago.                         |

### `PaymentType`

| Valor            | Significado                      |
| ---------------- | -------------------------------- |
| `PIX`            | Pagamento via Pix.               |
| `BOLETO`         | Pagamento via boleto.            |
| `CARTAO_CREDITO` | Pagamento via cartão de crédito. |

### `ProductStatus`

| Valor           | Significado                     |
| --------------- | ------------------------------- |
| `ATIVO`         | Produto disponível no catálogo. |
| `INDISPONIVEL`  | Produto temporariamente fora.   |
| `INATIVO`       | Produto desativado.             |

## Relacionamentos e regras

- **Isolamento**: `User` é a raiz do isolamento. `Person` e `Order` pertencem a um `User` (`onDelete: Cascade`). `Item` e `Payment` herdam o escopo indiretamente via `Order`.
- **Transição de status**: `Order.status` segue `PENDENTE` → `PARCIAL` → `QUITADO` conforme pagamentos são registrados.
- **Monetário**: todos os valores financeiros (`totalValue`, `chargedValue`, `memberPrice`, `pv`, `amount`, `regularPrice`) são `Decimal(10,2)` e manipulados em centavos inteiros na camada de aplicação.
- **Optionalidade**: `Item.productId` e `Item.personId` são opcionais (`onDelete: SetNull`); `Payment.personId` também é opcional.
- **Produtos**: `ProductPrice` mantém histórico temporal de preços (`validFrom`/`validTo`), permitindo auditar preços antigos sem alterar itens já registrados.
- **Enums**: `Order.status` usa `OrderStatus`; `Product.status` usa `ProductStatus`; `Order.paymentType` aceita `PaymentType` (opcional).
