import {
  Users,
  ClipboardList,
  ShoppingCart,
  Package,
  Boxes,
  Wallet,
} from 'lucide-react';

export const navigationItems = [
  { to: '/people', icon: Users, label: 'Clientes' },
  { to: '/orders', icon: ClipboardList, label: 'Pedidos dōTERRA' },
  { to: '/sales', icon: ShoppingCart, label: 'Vendas' },
  { to: '/products', icon: Package, label: 'Produtos' },
  { to: '/stock', icon: Boxes, label: 'Estoque' },
  { to: '/finances', icon: Wallet, label: 'Finanças' },
];
