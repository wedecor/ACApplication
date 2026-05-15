import { type LucideIcon } from 'lucide-react';
import * as React from 'react';

import { cn } from '../lib/cn';

export interface SidebarNavItem {
  label: string;
  href: string;
  icon?: LucideIcon;
  badge?: React.ReactNode;
  disabled?: boolean;
}

export interface SidebarSection {
  title?: string;
  items: SidebarNavItem[];
}

export interface SidebarProps extends React.HTMLAttributes<HTMLElement> {
  sections: SidebarSection[];
  /** Currently active route — caller decides the matching logic. */
  isActive?: (href: string) => boolean;
  /** Render-prop for the link component (Next.js / React Router agnostic). */
  renderLink: (item: SidebarNavItem, children: React.ReactNode) => React.ReactElement;
  header?: React.ReactNode;
  footer?: React.ReactNode;
  collapsed?: boolean;
}

export function Sidebar({
  sections,
  isActive,
  renderLink,
  header,
  footer,
  collapsed,
  className,
  ...props
}: SidebarProps) {
  return (
    <aside
      className={cn(
        'flex h-screen flex-col border-r bg-card text-card-foreground transition-[width] duration-200',
        collapsed ? 'w-16' : 'w-64',
        className,
      )}
      {...props}
    >
      {header ? <div className="flex h-14 items-center border-b px-4">{header}</div> : null}
      <nav className="flex-1 overflow-y-auto px-2 py-4">
        {sections.map((section, sIdx) => (
          <div key={sIdx} className="mb-4">
            {section.title && !collapsed ? (
              <p className="px-3 pb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {section.title}
              </p>
            ) : null}
            <ul className="space-y-0.5">
              {section.items.map((item) => {
                const Icon = item.icon;
                const active = isActive?.(item.href) ?? false;
                const content = (
                  <span
                    className={cn(
                      'group flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                      active
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                      item.disabled && 'pointer-events-none opacity-50',
                    )}
                  >
                    {Icon ? <Icon className="size-4 shrink-0" aria-hidden /> : null}
                    {!collapsed ? <span className="flex-1 truncate">{item.label}</span> : null}
                    {!collapsed && item.badge ? <span>{item.badge}</span> : null}
                  </span>
                );
                return <li key={item.href}>{renderLink(item, content)}</li>;
              })}
            </ul>
          </div>
        ))}
      </nav>
      {footer ? <div className="border-t p-3">{footer}</div> : null}
    </aside>
  );
}
