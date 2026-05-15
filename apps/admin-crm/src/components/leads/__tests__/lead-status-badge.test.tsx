import '@testing-library/jest-dom/vitest';
import { LeadStatus } from '@ac/types';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { LeadStatusBadge } from '../lead-status-badge';

describe('LeadStatusBadge', () => {
  it('renders the friendly label for each status', () => {
    const { rerender } = render(<LeadStatusBadge status={LeadStatus.NEW} />);
    expect(screen.getByText('New')).toBeInTheDocument();
    rerender(<LeadStatusBadge status={LeadStatus.QUALIFIED} />);
    expect(screen.getByText('Qualified')).toBeInTheDocument();
    rerender(<LeadStatusBadge status={LeadStatus.BOOKING_CREATED} />);
    expect(screen.getByText('Converted')).toBeInTheDocument();
  });
});
