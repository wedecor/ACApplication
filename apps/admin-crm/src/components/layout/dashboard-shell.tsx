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
  Menu,
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
  X,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactElement, ReactNode } from 'react';

import { Avatar, AvatarFallback, Navbar, Sidebar, type SidebarNavItem } from '@ac/ui';

import { PermissionGate } from '@/components/auth/permission-gate';
import { apiFetch } from '@/lib/api/client';
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

function initialsOf(name: string | undefined): string {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  return ((parts[0]![0] ?? '') + (parts.length > 1 ? (parts[parts.length - 1]![0] ?? '') : '')).toUpperCase();
}

/** Longest nav href that prefixes the path wins, so /campaigns/segments highlights Campaigns. */
function activeHrefFor(pathname: string, hrefs: string[]): string | null {
  if (pathname === '/') return '/';
  return (
    hrefs
      .filter((h) => h !== '/' && (pathname === h || pathname.startsWith(`${h}/`)))
      .sort((a, b) => b.length - a.length)[0] ?? null
  );
}

const Brand = (
  <Link href="/" className="flex items-center gap-2 text-lg font-semibold">
    <span className="grid size-7 place-items-center rounded-md bg-primary text-primary-foreground">A</span>
    AC Admin
  </Link>
);

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const { permissions } = readSessionClaims();
  const pathname = usePathname() ?? '/';
  const drawerRef = useRef<HTMLDialogElement>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const sections = useMemo(() => {
    return ALL_SECTIONS.map((section) => ({
      ...section,
      items: section.items.filter((item) => {
        const required = permissionsForPath(item.href);
        return required.length === 0 || hasAllPermissions(required, permissions);
      }),
    })).filter((section) => section.items.length > 0);
  }, [permissions]);

  const activeHref = useMemo(
    () => activeHrefFor(pathname, sections.flatMap((s) => s.items.map((i) => i.href))),
    [pathname, sections],
  );

  const { data: me } = useQuery({
    queryKey: ['users', 'me', 'profile'],
    queryFn: () => apiFetch<{ fullName?: string; email?: string; phone?: string }>('/users/me'),
    staleTime: 5 * 60_000,
  });
  const displayName = me?.fullName ?? me?.email ?? me?.phone;

  // Close the mobile drawer whenever navigation happens.
  useEffect(() => {
    drawerRef.current?.close();
  }, [pathname]);

  const openDrawer = () => drawerRef.current?.showModal();
  const closeDrawer = () => drawerRef.current?.close();

  const renderLink = (item: SidebarNavItem, linkChildren: ReactNode): ReactElement => (
    <Link href={item.href} aria-current={item.href === activeHref ? 'page' : undefined}>
      {linkChildren}
    </Link>
  );
  const isActive = (href: string) => href === activeHref;

  return (
    <PermissionGate>
      <div className="flex min-h-screen">
        <Sidebar
          className="sticky top-0 hidden shrink-0 lg:flex"
          sections={sections}
          isActive={isActive}
          header={Brand}
          renderLink={renderLink}
        />

        {/* Mobile / tablet navigation: native modal dialog gives focus trap, Esc and backdrop. */}
        <dialog
          ref={drawerRef}
          aria-label="Main navigation"
          onClose={() => setDrawerOpen(false)}
          onClick={(e) => {
            if (e.target === e.currentTarget) closeDrawer();
          }}
          className="m-0 h-dvh max-h-none w-72 max-w-[85vw] bg-transparent p-0 backdrop:bg-foreground/40 open:animate-in open:slide-in-from-left lg:hidden"
        >
          <Sidebar
            className="h-dvh w-full border-r-0 shadow-lg"
            sections={sections}
            isActive={isActive}
            header={
              <div className="flex w-full items-center justify-between">
                {Brand}
                <button
                  type="button"
                  autoFocus
                  onClick={closeDrawer}
                  aria-label="Close navigation"
                  className="-mr-2 grid size-10 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <X className="size-5" aria-hidden />
                </button>
              </div>
            }
            renderLink={renderLink}
          />
        </dialog>

        <div className="flex min-w-0 flex-1 flex-col">
          <Navbar
            className="px-3 sm:px-6"
            leading={
              <div className="flex items-center gap-2 lg:hidden">
                <button
                  type="button"
                  onClick={() => {
                    openDrawer();
                    setDrawerOpen(true);
                  }}
                  aria-label="Open navigation"
                  aria-expanded={drawerOpen}
                  className="grid size-10 place-items-center rounded-md text-foreground hover:bg-muted"
                >
                  <Menu className="size-5" aria-hidden />
                </button>
                {Brand}
              </div>
            }
            trailing={
              <Avatar title={displayName} aria-label={displayName ? `Signed in as ${displayName}` : undefined}>
                <AvatarFallback>{initialsOf(displayName)}</AvatarFallback>
              </Avatar>
            }
          />
          <main className="min-w-0 flex-1 p-4 sm:p-6">{children}</main>
        </div>
      </div>
    </PermissionGate>
  );
}
