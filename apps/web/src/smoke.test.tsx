import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { APP_NAME } from '@ortak-perde/shared';

describe('web smoke', () => {
  it('renders', () => {
    render(<h1>{APP_NAME}</h1>);
    expect(screen.getByRole('heading')).toHaveTextContent('Ortak Perde');
  });
});
