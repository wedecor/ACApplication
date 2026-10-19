'use client';

import * as React from 'react';

import { cn } from '../lib/cn';

export interface TableProps extends React.HTMLAttributes<HTMLTableElement> {
  /**
   * Below `md`, render each row as a stacked card: the header is visually
   * hidden and every cell is labelled with its column heading (copied from
   * `<th>` automatically). Mark the title cell with `data-primary`; hide a
   * cell on phones with `className="max-md:hidden"`.
   */
  stackOnMobile?: boolean;
}

/** Copy each column's header text onto its body cells as `data-label`. */
function useColumnLabels(ref: React.RefObject<HTMLTableElement>, enabled: boolean) {
  React.useEffect(() => {
    const table = ref.current;
    if (!enabled || !table) return;
    const apply = () => {
      const headers: string[] = [];
      table.querySelectorAll('thead tr:last-child th').forEach((th) => {
        const span = Number(th.getAttribute('colspan') ?? 1);
        const text = (th.textContent ?? '').trim();
        for (let i = 0; i < span; i += 1) headers.push(text);
      });
      table.querySelectorAll('tbody tr').forEach((tr) => {
        let col = 0;
        Array.from(tr.children).forEach((cell) => {
          const label = headers[col] ?? '';
          if (cell.getAttribute('data-label') !== label) cell.setAttribute('data-label', label);
          col += Number(cell.getAttribute('colspan') ?? 1);
        });
      });
    };
    apply();
    const observer = new MutationObserver(apply);
    observer.observe(table, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [ref, enabled]);
}

export const Table = React.forwardRef<HTMLTableElement, TableProps>(
  ({ className, stackOnMobile = false, ...props }, forwardedRef) => {
    const innerRef = React.useRef<HTMLTableElement>(null);
    React.useImperativeHandle(forwardedRef, () => innerRef.current!);
    useColumnLabels(innerRef, stackOnMobile);
    return (
      <div className={cn('relative w-full', stackOnMobile ? 'md:overflow-auto' : 'overflow-auto')}>
        <table
          ref={innerRef}
          className={cn('w-full caption-bottom text-sm', stackOnMobile && 'table-stack', className)}
          {...props}
        />
      </div>
    );
  },
);
Table.displayName = 'Table';

export const TableHeader = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <thead ref={ref} className={cn('[&_tr]:border-b bg-muted/40', className)} {...props} />
));
TableHeader.displayName = 'TableHeader';

export const TableBody = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tbody ref={ref} className={cn('[&_tr:last-child]:border-0', className)} {...props} />
));
TableBody.displayName = 'TableBody';

export const TableFooter = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tfoot
    ref={ref}
    className={cn('border-t bg-muted/40 font-medium', className)}
    {...props}
  />
));
TableFooter.displayName = 'TableFooter';

export const TableRow = React.forwardRef<
  HTMLTableRowElement,
  React.HTMLAttributes<HTMLTableRowElement>
>(({ className, ...props }, ref) => (
  <tr
    ref={ref}
    className={cn(
      'border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted',
      className,
    )}
    {...props}
  />
));
TableRow.displayName = 'TableRow';

export const TableHead = React.forwardRef<
  HTMLTableCellElement,
  React.ThHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <th
    ref={ref}
    className={cn(
      'h-10 px-3 text-left align-middle text-xs font-semibold uppercase tracking-wide text-muted-foreground',
      className,
    )}
    {...props}
  />
));
TableHead.displayName = 'TableHead';

export const TableCell = React.forwardRef<
  HTMLTableCellElement,
  React.TdHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <td ref={ref} className={cn('p-3 align-middle', className)} {...props} />
));
TableCell.displayName = 'TableCell';

export const TableCaption = React.forwardRef<
  HTMLTableCaptionElement,
  React.HTMLAttributes<HTMLTableCaptionElement>
>(({ className, ...props }, ref) => (
  <caption ref={ref} className={cn('mt-4 text-sm text-muted-foreground', className)} {...props} />
));
TableCaption.displayName = 'TableCaption';
