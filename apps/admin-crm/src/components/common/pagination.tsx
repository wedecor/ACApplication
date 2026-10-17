'use client';

import { Button } from '@ac/ui';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface Props {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export function Pagination({ page, pageSize, total, totalPages, onPageChange }: Props) {
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  return (
    <nav aria-label="Pagination" className="flex items-center justify-between gap-3 py-3">
      <span className="text-sm text-muted-foreground tabular-nums">
        {from}–{to} of {total.toLocaleString('en-IN')}
      </span>
      <div className="flex items-center gap-1">
        <Button
          size="icon"
          variant="outline"
          aria-label="Previous page"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          <ChevronLeft aria-hidden />
        </Button>
        <span className="px-2 text-sm tabular-nums" aria-current="page">
          {page} / {Math.max(totalPages, 1)}
        </span>
        <Button
          size="icon"
          variant="outline"
          aria-label="Next page"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          <ChevronRight aria-hidden />
        </Button>
      </div>
    </nav>
  );
}
