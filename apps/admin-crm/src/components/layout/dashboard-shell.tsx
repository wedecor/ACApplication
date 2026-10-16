'use client';

import {
  Activity,
  AlertTriangle,
  BarChart3,
  Bell,
  BookOpen,
  Boxes,
  Briefcase,
  Building2,
  CalendarCheck,
  ClipboardCheck,
  ClipboardList,
  Download,
  CreditCard,
  Factory,
  Gift,
  GitBranch,
  Headphones,
  Inbox,
  LayoutDashboard,
  LifeBuoy,
  Map,
  ListChecks,
  MessageCircleHeart,
  MessagesSquare,
  Megaphone,
  PhoneCall,
  Receipt,
  Refrigerator,
  Repeat,
  Settings,
  ShieldAlert,
  ShieldCheck,
  ShoppingCart,
  Smile,
  Tag,
  Target,
  Timer,
  UserCog,
  Users,
  Wallet,
  Warehouse as WarehouseIcon,
  Wrench,
} from 'lucide-react';
import Link from 'next/link';
import { useMemo } from 'react';
import type { ReactElement, ReactNode } from 'react';

import { Avatar, AvatarFallback, Navbar, Sidebar, type SidebarNavItem } from '@ac/ui';

import { PermissionGate } from '@/components/auth/permission-gate';
import { hasAllPermissions, readSessionClaims } from '@/lib/rbac/permissions';
import { permissionsForPath } from '@/lib/rbac/route-access';

type NavItem = SidebarNavItem & { href: string };

const ALL_SECTIONS: Array<{ title?: string; items: NavItem[] }> = [
  {
    items: [
      { label: 'Dashboard', href: '/', icon: LayoutDashboard },
      { label: 'Live Dispatch', href: '/dispatch', icon: Activity },
      { label: 'Live Map', href: '/live-map', icon: Map },
      { label: 'Leads', href: '/leads', icon: Inbox },
      { label: 'Bookings', href: '/bookings', icon: CalendarCheck },
    ],
  },
  {
    title: 'Operations',
    items: [
      { label: 'Customers', href: '/customers', icon: Users },
      { label: 'Technicians', href: '/technicians', icon: Wrench },
      { label: 'Tasks', href: '/tasks', icon: ListChecks },
    ],
  },
  {
    title: 'Repair',
    items: [
      { label: 'Appliances', href: '/appliances', icon: Refrigerator },
      { label: 'Job Cards', href: '/job-cards', icon: ClipboardCheck },
      { label: 'Warranty Claims', href: '/warranty', icon: ShieldAlert },
      { label: 'Workshop', href: '/workshop', icon: Factory },
      { label: 'Service Catalog', href: '/service-catalog', icon: ClipboardList },
    ],
  },
  {
    title: 'Sales & Growth',
    items: [
      { label: 'Accounts', href: '/accounts', icon: Briefcase },
      { label: 'Pipeline', href: '/opportunities', icon: Target },
      { label: 'Campaigns', href: '/campaigns', icon: Megaphone },
      { label: 'Coupons', href: '/coupons', icon: Tag },
      { label: 'Referrals', href: '/referrals', icon: Gift },
    ],
  },
  {
    title: 'Finance',
    items: [
      { label: 'Overview', href: '/finance', icon: BarChart3 },
      { label: 'Invoices', href: '/invoices', icon: Receipt },
      { label: 'Payments', href: '/payments', icon: CreditCard },
      { label: 'AMC', href: '/amc', icon: ShieldCheck },
      { label: 'Payouts', href: '/payouts', icon: Wallet },
    ],
  },
  {
    title: 'Inventory',
    items: [
      { label: 'Catalogue', href: '/inventory', icon: Boxes },
      { label: 'Warehouses', href: '/warehouses', icon: WarehouseIcon },
      { label: 'Vendors', href: '/vendors', icon: Building2 },
      { label: 'Purchase Orders', href: '/purchase-orders', icon: ShoppingCart },
      { label: 'Transfers', href: '/transfers', icon: Repeat },
      { label: 'Alerts', href: '/inventory-alerts', icon: AlertTriangle },
    ],
  },
  {
    title: 'Support',
    items: [
      { label: 'Overview', href: '/support', icon: Headphones },
      { label: 'Inbox', href: '/inbox', icon: MessagesSquare },
      { label: 'Tickets', href: '/tickets', icon: LifeBuoy },
      { label: 'Call Center', href: '/call-center', icon: PhoneCall },
      { label: 'CSAT', href: '/csat', icon: Smile },
      { label: 'Knowledge Base', href: '/knowledge-base', icon: BookOpen },
      { label: 'SLA', href: '/sla', icon: Timer },
      { label: 'Canned Replies', href: '/canned-responses', icon: MessageCircleHeart },
    ],
  },
  {
    title: 'System',
    items: [
      { label: 'Notifications', href: '/notifications', icon: Bell },
      { label: 'Automation', href: '/automation', icon: GitBranch },
      { label: 'Users & Roles', href: '/users', icon: UserCog },
      { label: 'Import / Export', href: '/data', icon: Download },
      { label: 'Settings', href: '/settings', icon: Settings },
    ],
  },
];

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const { permissions } = readSessionClaims();

  const sections = useMemo(() => {
    return ALL_SECTIONS.map((section) => ({
      ...section,
      items: section.items.filter((item) => {
        const required = permissionsForPath(item.href);
        return required.length === 0 || hasAllPermissions(required, permissions);
      }),
    })).filter((section) => section.items.length > 0);
  }, [permissions]);

  return (
    <PermissionGate>
      <div className="flex min-h-screen">
        <Sidebar
          sections={sections}
          header={
            <Link href="/" className="flex items-center gap-2 text-lg font-semibold">
              <span className="grid size-7 place-items-center rounded-md bg-primary text-primary-foreground">
                A
              </span>
              AC Admin
            </Link>
          }
          renderLink={(item: SidebarNavItem, linkChildren: ReactNode): ReactElement => (
            <Link href={item.href}>{linkChildren}</Link>
          )}
        />
        <div className="flex flex-1 flex-col">
          <Navbar
            trailing={
              <Avatar>
                <AvatarFallback>OP</AvatarFallback>
              </Avatar>
            }
          />
          <main className="flex-1 overflow-y-auto p-6">{children}</main>
        </div>
      </div>
    </PermissionGate>
  );
}
