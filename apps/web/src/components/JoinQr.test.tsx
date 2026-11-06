import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { resolveJoinBase, buildJoinUrl } from '@ortak-perde/shared';
import { JoinQr } from './JoinQr';

function renderFor(origin: string, lanIp: string | null, publicUrl: string | null = null) {
  const base = resolveJoinBase({ publicUrl, lanIp, origin });
  return render(<JoinQr joinUrl={buildJoinUrl(base, 'ABCD')} joinBase={base} code="ABCD" />);
}

describe('JoinQr', () => {
  it('encodes the LAN address when the host screen runs on localhost', async () => {
    renderFor('http://localhost:5173', '192.168.1.42');
    const img = await screen.findByTestId('join-qr');
    expect(img).toHaveAttribute('data-url', 'http://192.168.1.42:5173/join/ABCD');
    expect(img.getAttribute('src')).toMatch(/^data:image\/png;base64,/);
    expect(screen.getByText('192.168.1.42:5173/join')).toBeInTheDocument();
    expect(screen.getByTestId('room-code')).toHaveTextContent('ABCD');
  });

  it('prefers PUBLIC_URL', async () => {
    renderFor('http://localhost:5173', '192.168.1.42', 'https://perde.example.com');
    expect(await screen.findByTestId('join-qr')).toHaveAttribute(
      'data-url',
      'https://perde.example.com/join/ABCD',
    );
    expect(screen.getByText('perde.example.com/join')).toBeInTheDocument();
  });

  it('never shows a localhost QR code', () => {
    renderFor('http://localhost:3000', null);
    expect(screen.queryByTestId('join-qr')).toBeNull();
    expect(screen.getByText(/PUBLIC_URL/)).toBeInTheDocument();
  });
});
