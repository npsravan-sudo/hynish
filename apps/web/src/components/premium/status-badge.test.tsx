import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatusBadge } from './status-badge';

describe('StatusBadge', () => {
  it('renders the legacy label for a status', () => {
    render(<StatusBadge status="without-gst" />);
    expect(screen.getByText('Without GST')).toBeInTheDocument();
  });

  it('renders paid/overdue labels', () => {
    const { rerender } = render(<StatusBadge status="paid" />);
    expect(screen.getByText('Paid')).toBeInTheDocument();
    rerender(<StatusBadge status="overdue" />);
    expect(screen.getByText('Overdue')).toBeInTheDocument();
  });
});
