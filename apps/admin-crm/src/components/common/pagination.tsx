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
    <div className="flex items-center justify-between gap-3 py-3">
      <span className="text-xs text-muted-foreground">
        {from}-{to} of {total.toLocaleString()}
      </span>
      <div className="flex items-center gap-1">
        <Button
          size="sm"
          variant="outline"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          <ChevronLeft className="size-4" />
        </Button>
        <span className="px-2 text-sm tabular-nums">
          Page {page} / {totalPages}
        </span>
        <Button
          size="sm"
          variant="outline"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          <ChevronRight className="size-4" />
        </Button>
      </div>
    </div>
  );
}
