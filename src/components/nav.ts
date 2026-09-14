/** Sidebar navigation for the admin panel. */
export interface NavItem {
  href: string;
  label: string;
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/products", label: "Produtos" },
  { href: "/conversations", label: "Conversas" },
  { href: "/customers", label: "Clientes" },
  { href: "/orders", label: "Pedidos" },
  { href: "/knowledge", label: "Conhecimento" },
  { href: "/settings", label: "Configurações" },
  { href: "/integrations", label: "Integrações" },
];
