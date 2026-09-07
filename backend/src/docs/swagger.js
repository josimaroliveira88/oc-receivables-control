import path from 'node:path';
import { fileURLToPath } from 'node:url';
import swaggerJsdoc from 'swagger-jsdoc';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const errorResponse = (description) => ({
  description,
  content: {
    'application/json': { schema: { $ref: '#/components/schemas/Error' } },
  },
});

const options = {
  definition: {
    openapi: '3.0.3',
    info: {
      title: 'Receivables Control API',
      version: '1.0.0',
      description:
        'API do sistema de controle de recebíveis: clientes, pedidos dōTERRA, vendas, pagamentos, dashboard, catálogo e estoque.',
    },
    servers: [
      {
        url: '/',
        description:
          'Mesma origem (proxy do Vite em dev / reverse proxy em prod)',
      },
      { url: 'http://localhost:4000', description: 'Backend direto' },
    ],
    tags: [
      { name: 'Auth', description: 'Login e auto-registro' },
      {
        name: 'People',
        description:
          'CRUD de clientes, resumo financeiro e histórico de compras',
      },
      {
        name: 'Orders',
        description: 'Pedidos de compra (COMPRA), pagamentos, saldos e anexos',
      },
      {
        name: 'Sales',
        description: 'Vendas (VENDA), baixa de estoque e entrega',
      },
      {
        name: 'Dashboard',
        description: 'KPIs, saldos por cliente e fechamento anual',
      },
      {
        name: 'Products',
        description: 'Catálogo, tipos de preço, kits e composição',
      },
      { name: 'Stock', description: 'Saldo de estoque e movimentações' },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
      responses: {
        BadRequest: errorResponse(
          'Requisição inválida (validação Zod ou regra de negócio)',
        ),
        Unauthorized: errorResponse('JWT ausente, expirado ou inválido'),
        NotFound: errorResponse('Recurso inexistente ou de outro usuário'),
        Conflict: errorResponse('Conflito (recurso já existe)'),
        ServerError: errorResponse('Erro interno'),
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            error: {
              description: 'Mensagem de erro ou lista de erros do Zod',
              oneOf: [
                { type: 'string' },
                { type: 'array', items: { type: 'object' } },
              ],
            },
          },
        },
        LoginInput: {
          type: 'object',
          required: ['username', 'password'],
          properties: {
            username: { type: 'string' },
            password: { type: 'string', format: 'password' },
          },
        },
        LoginResponse: {
          type: 'object',
          properties: {
            token: {
              type: 'string',
              description: 'JWT para o header Authorization: Bearer <token>',
            },
            expiresIn: { type: 'string', example: '7d' },
          },
        },
        RegisterInput: {
          type: 'object',
          required: ['username', 'password'],
          properties: {
            username: { type: 'string', minLength: 3 },
            password: { type: 'string', format: 'password', minLength: 6 },
          },
        },
        RegisterResponse: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            username: { type: 'string' },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        Message: {
          type: 'object',
          properties: {
            message: { type: 'string' },
          },
        },
        PaymentType: {
          type: 'string',
          enum: ['PIX', 'BOLETO', 'CARTAO_CREDITO', 'INFINITE_PAY'],
        },
        Person: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            name: { type: 'string' },
            whatsapp: { type: 'string', nullable: true },
            commonGroups: { type: 'string', nullable: true },
            instagram: { type: 'string', nullable: true },
            address: { type: 'string', nullable: true },
            observacao: { type: 'string', nullable: true },
            birthday: { type: 'string', example: '14/03', nullable: true },
            isVip: { type: 'boolean' },
            isDoterraMember: { type: 'boolean' },
            isTeamMember: { type: 'boolean' },
            isSelf: { type: 'boolean' },
          },
        },
        PersonInput: {
          type: 'object',
          required: ['name'],
          properties: {
            name: { type: 'string' },
            whatsapp: { type: 'string', nullable: true },
            commonGroups: { type: 'string', maxLength: 255, nullable: true },
            instagram: { type: 'string', maxLength: 255, nullable: true },
            address: { type: 'string', maxLength: 500, nullable: true },
            observacao: { type: 'string', maxLength: 2000, nullable: true },
            birthday: { type: 'string', example: '14/03', nullable: true },
            isVip: { type: 'boolean' },
            isDoterraMember: { type: 'boolean' },
            isTeamMember: { type: 'boolean' },
            isSelf: { type: 'boolean' },
          },
        },
        PersonSummary: {
          type: 'object',
          properties: {
            itemTotalCents: { type: 'integer' },
            paymentTotalCents: { type: 'integer' },
            pendingCents: { type: 'integer' },
          },
        },
        PersonPurchase: {
          type: 'object',
          properties: {
            orderId: { type: 'string', format: 'uuid' },
            orderType: { type: 'string', enum: ['COMPRA', 'VENDA'] },
            orderDate: { type: 'string', format: 'date-time' },
            name: { type: 'string' },
            quantity: { type: 'integer' },
            totalCents: { type: 'integer' },
          },
        },
        OrderItemInput: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid', nullable: true },
            description: { type: 'string', maxLength: 500, nullable: true },
            chargedValue: { type: 'number', minimum: 0, default: 0 },
            personId: { type: 'string', format: 'uuid', nullable: true },
            productId: { type: 'string', format: 'uuid', nullable: true },
            memberPrice: { type: 'number', minimum: 0, nullable: true },
            details: { type: 'string', maxLength: 500, nullable: true },
            quantity: { type: 'integer', minimum: 1, default: 1 },
            forStock: { type: 'boolean' },
            useCashback: { type: 'boolean' },
            chargedValueMode: {
              type: 'string',
              enum: ['UNIT', 'TOTAL'],
              default: 'UNIT',
            },
            kitStockMode: {
              type: 'string',
              enum: ['KIT', 'COMPONENTS'],
              nullable: true,
            },
          },
        },
        OrderInput: {
          type: 'object',
          required: ['orderNumber', 'items'],
          properties: {
            orderNumber: { type: 'string' },
            orderDate: { type: 'string', example: '2026-09-07' },
            shippingValue: { type: 'number', minimum: 0, nullable: true },
            isTeamOrder: { type: 'boolean' },
            accountOwner: { type: 'string', maxLength: 120, nullable: true },
            paymentType: {
              $ref: '#/components/schemas/PaymentType',
              nullable: true,
            },
            orderNotes: { type: 'string', maxLength: 500, nullable: true },
            doterraPv: { type: 'number', minimum: 0, nullable: true },
            items: {
              type: 'array',
              minItems: 1,
              items: { $ref: '#/components/schemas/OrderItemInput' },
            },
          },
        },
        OrderUpdateInput: {
          type: 'object',
          properties: {
            orderNumber: { type: 'string' },
            orderDate: { type: 'string', example: '2026-09-07' },
            shippingValue: { type: 'number', minimum: 0, nullable: true },
            isTeamOrder: { type: 'boolean' },
            accountOwner: { type: 'string', maxLength: 120, nullable: true },
            paymentType: {
              $ref: '#/components/schemas/PaymentType',
              nullable: true,
            },
            orderNotes: { type: 'string', maxLength: 500, nullable: true },
            doterraPv: { type: 'number', minimum: 0, nullable: true },
            items: {
              type: 'array',
              minItems: 1,
              items: { $ref: '#/components/schemas/OrderItemInput' },
            },
          },
        },
        OrderItem: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            description: { type: 'string', nullable: true },
            chargedValue: { type: 'number' },
            chargedValueMode: { type: 'string', enum: ['UNIT', 'TOTAL'] },
            quantity: { type: 'integer' },
            personId: { type: 'string', format: 'uuid', nullable: true },
            productId: { type: 'string', format: 'uuid', nullable: true },
          },
        },
        Order: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            orderNumber: { type: 'string' },
            orderDate: { type: 'string', format: 'date-time' },
            orderType: { type: 'string', enum: ['COMPRA', 'VENDA'] },
            status: {
              type: 'string',
              enum: ['PENDENTE', 'PARCIAL', 'QUITADO', 'EQUIPE'],
            },
            totalValue: { type: 'number' },
            shippingValue: { type: 'number', nullable: true },
            isTeamOrder: { type: 'boolean' },
            attachmentFilename: { type: 'string', nullable: true },
            items: {
              type: 'array',
              items: { $ref: '#/components/schemas/OrderItem' },
            },
            payments: {
              type: 'array',
              items: { $ref: '#/components/schemas/Payment' },
            },
          },
        },
        Payment: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            amount: { type: 'number' },
            personId: { type: 'string', format: 'uuid' },
            orderId: { type: 'string', format: 'uuid' },
            paidAt: { type: 'string', format: 'date-time' },
            paymentType: {
              $ref: '#/components/schemas/PaymentType',
              nullable: true,
            },
            notes: { type: 'string', nullable: true },
          },
        },
        PaymentInput: {
          type: 'object',
          required: ['amount', 'personId'],
          properties: {
            amount: { type: 'number', minimum: 0 },
            personId: { type: 'string', format: 'uuid' },
            paidAt: { type: 'string', example: '2026-09-07' },
            paymentType: {
              $ref: '#/components/schemas/PaymentType',
              nullable: true,
            },
            notes: { type: 'string' },
          },
        },
        PaymentUpdateInput: {
          type: 'object',
          required: ['amount'],
          properties: {
            amount: { type: 'number', minimum: 0 },
            paidAt: { type: 'string', example: '2026-09-07' },
            paymentType: {
              $ref: '#/components/schemas/PaymentType',
              nullable: true,
            },
            notes: { type: 'string', nullable: true },
          },
        },
        PaymentResult: {
          type: 'object',
          properties: {
            message: { type: 'string' },
            payment: { $ref: '#/components/schemas/Payment' },
            order: { $ref: '#/components/schemas/Order' },
          },
        },
        PersonBalance: {
          type: 'object',
          properties: {
            personId: { type: 'string', format: 'uuid' },
            personName: { type: 'string' },
            isSelf: { type: 'boolean' },
            itemTotal: { type: 'number' },
            paymentTotal: { type: 'number' },
            pending: { type: 'number' },
          },
        },
        OrderBalance: {
          type: 'object',
          properties: {
            orderId: { type: 'string', format: 'uuid' },
            orderNumber: { type: 'string' },
            orderStatus: { type: 'string' },
            balances: {
              type: 'array',
              items: { $ref: '#/components/schemas/PersonBalance' },
            },
          },
        },
        AttachmentResponse: {
          type: 'object',
          properties: {
            attachmentFilename: { type: 'string' },
          },
        },
        SaleItemInput: {
          type: 'object',
          required: ['productId'],
          properties: {
            id: { type: 'string', format: 'uuid', nullable: true },
            description: { type: 'string', maxLength: 500, nullable: true },
            chargedValue: { type: 'number', minimum: 0, default: 0 },
            productId: { type: 'string', format: 'uuid' },
            memberPrice: { type: 'number', minimum: 0, nullable: true },
            details: { type: 'string', maxLength: 500, nullable: true },
            quantity: { type: 'integer', minimum: 1, default: 1 },
            chargedValueMode: {
              type: 'string',
              enum: ['UNIT', 'TOTAL'],
              default: 'UNIT',
            },
            kitStockMode: {
              type: 'string',
              enum: ['KIT', 'COMPONENTS'],
              nullable: true,
            },
            useCashback: { type: 'boolean' },
          },
        },
        SaleInput: {
          type: 'object',
          required: ['clientPersonId', 'items'],
          properties: {
            clientPersonId: { type: 'string', format: 'uuid' },
            orderDate: { type: 'string', example: '2026-09-07' },
            shippingValue: { type: 'number', minimum: 0, nullable: true },
            additionalValue: { type: 'number', minimum: 0, nullable: true },
            description: { type: 'string', maxLength: 500, nullable: true },
            deliveredAt: { type: 'string', nullable: true },
            items: {
              type: 'array',
              minItems: 1,
              items: { $ref: '#/components/schemas/SaleItemInput' },
            },
          },
        },
        SaleUpdateInput: {
          type: 'object',
          properties: {
            clientPersonId: { type: 'string', format: 'uuid' },
            orderDate: { type: 'string', example: '2026-09-07' },
            shippingValue: { type: 'number', minimum: 0, nullable: true },
            additionalValue: { type: 'number', minimum: 0, nullable: true },
            description: { type: 'string', maxLength: 500, nullable: true },
            deliveredAt: { type: 'string', nullable: true },
            items: {
              type: 'array',
              minItems: 1,
              items: { $ref: '#/components/schemas/SaleItemInput' },
            },
          },
        },
        DashboardSummary: {
          type: 'object',
          properties: {
            totalPending: { type: 'number' },
            totalPaid: { type: 'number' },
            currentMonthReceipts: { type: 'number' },
            personBalances: {
              type: 'array',
              items: { $ref: '#/components/schemas/PersonBalance' },
            },
            yearlyBreakdown: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  year: { type: 'integer' },
                  totalPending: { type: 'number' },
                  totalQuitado: { type: 'number' },
                },
              },
            },
          },
        },
        ProductComponentInput: {
          type: 'object',
          required: ['componentProductId', 'quantity'],
          properties: {
            componentProductId: { type: 'string', format: 'uuid' },
            quantity: { type: 'integer', minimum: 1 },
          },
        },
        ProductInput: {
          type: 'object',
          required: [
            'code',
            'name',
            'size',
            'regularPrice',
            'memberPrice',
            'pv',
          ],
          properties: {
            code: { type: 'string' },
            name: { type: 'string' },
            size: { type: 'string' },
            regularPrice: { type: 'number', minimum: 0 },
            memberPrice: { type: 'number', minimum: 0 },
            pv: { type: 'number', minimum: 0 },
            doterraUrl: { type: 'string', format: 'uri', nullable: true },
            productType: {
              type: 'string',
              enum: ['SIMPLES', 'KIT'],
              default: 'SIMPLES',
            },
            components: {
              type: 'array',
              items: { $ref: '#/components/schemas/ProductComponentInput' },
            },
          },
        },
        ProductUpdateInput: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            size: { type: 'string' },
            status: {
              type: 'string',
              enum: ['ATIVO', 'INDISPONIVEL', 'INATIVO'],
            },
            doterraUrl: { type: 'string', format: 'uri', nullable: true },
            regularPrice: { type: 'number', minimum: 0 },
            memberPrice: { type: 'number', minimum: 0 },
            pv: { type: 'number', minimum: 0 },
            productType: { type: 'string', enum: ['SIMPLES', 'KIT'] },
            components: {
              type: 'array',
              items: { $ref: '#/components/schemas/ProductComponentInput' },
            },
          },
        },
        Product: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            code: { type: 'string' },
            name: { type: 'string' },
            size: { type: 'string' },
            status: {
              type: 'string',
              enum: ['ATIVO', 'INDISPONIVEL', 'INATIVO'],
            },
            productType: { type: 'string', enum: ['SIMPLES', 'KIT'] },
            regularPrice: { type: 'number' },
            memberPrice: { type: 'number' },
            pv: { type: 'number' },
          },
        },
        Pagination: {
          type: 'object',
          properties: {
            page: { type: 'integer' },
            pageSize: { type: 'integer' },
            total: { type: 'integer' },
          },
        },
        PaginatedProducts: {
          type: 'object',
          properties: {
            data: {
              type: 'array',
              items: { $ref: '#/components/schemas/Product' },
            },
            pagination: { $ref: '#/components/schemas/Pagination' },
          },
        },
        MovementInput: {
          type: 'object',
          required: ['productId', 'type', 'quantity'],
          properties: {
            productId: { type: 'string', format: 'uuid' },
            type: { type: 'string', enum: ['ENTRADA', 'SAIDA', 'AJUSTE'] },
            quantity: { type: 'integer' },
            reason: { type: 'string', maxLength: 255 },
            effectiveDate: { type: 'string', example: '2026-09-07' },
          },
        },
        StockMovement: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            productId: { type: 'string', format: 'uuid' },
            type: { type: 'string', enum: ['ENTRADA', 'SAIDA', 'AJUSTE'] },
            quantity: { type: 'integer' },
            reason: { type: 'string', nullable: true },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        InventoryItem: {
          type: 'object',
          properties: {
            productId: { type: 'string', format: 'uuid' },
            code: { type: 'string' },
            name: { type: 'string' },
            size: { type: 'string' },
            quantity: { type: 'integer' },
          },
        },
        MovementResult: {
          type: 'object',
          properties: {
            movement: { $ref: '#/components/schemas/StockMovement' },
            inventory: { $ref: '#/components/schemas/InventoryItem' },
          },
        },
      },
    },
    // por padrão tudo exige JWT; rotas públicas sobrescrevem com security: []
    security: [{ bearerAuth: [] }],
  },
  // arquivos onde ficam as anotações @openapi
  apis: [path.join(__dirname, '..', 'routes', '*.js')],
};

export default swaggerJsdoc(options);
