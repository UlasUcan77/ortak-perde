import type { GameResults, Movie, PlayerPublic } from '@ortak-perde/shared';

const W = 1080;
const H = 1350;

export interface ShareCardText {
  heading: string;
  agreement: string | null;
  meta: string;
  footer: string;
  attribution: string;
}

/** Same-origin poster URL (proxied by our server) so the canvas is not tainted by CORS. */
export function proxiedPoster(url: string | null): string | null {
  const m = url?.match(
    /^https:\/\/image\.tmdb\.org\/t\/p(\/w\d{2,3}\/[A-Za-z0-9_-]+\.(?:jpg|jpeg|png|webp))$/,
  );
  return m ? `/api/poster${m[1]}` : null;
}

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function wrap(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number,
): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
      if (lines.length === maxLines) break;
    } else {
      line = test;
    }
  }
  if (lines.length < maxLines && line) lines.push(line);
  if (lines.length === maxLines && words.join(' ') !== lines.join(' ')) {
    lines[maxLines - 1] = `${lines[maxLines - 1]!.replace(/\s+\S*$/, '')}…`;
  }
  return lines;
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

async function drawPoster(
  ctx: CanvasRenderingContext2D,
  movie: Movie,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  ctx.save();
  roundRect(ctx, x, y, w, h, 36);
  ctx.clip();
  const src = proxiedPoster(movie.posterUrl);
  const img = src ? await loadImage(src) : null;
  if (img) {
    const scale = Math.max(w / img.width, h / img.height);
    const iw = img.width * scale;
    const ih = img.height * scale;
    ctx.drawImage(img, x + (w - iw) / 2, y + (h - ih) / 2, iw, ih);
  } else {
    const hue = movie.placeholderHue ?? (movie.id * 47) % 360;
    const g = ctx.createLinearGradient(x, y, x + w, y + h);
    g.addColorStop(0, `hsl(${hue} 55% 40%)`);
    g.addColorStop(1, `hsl(${hue + 35} 45% 12%)`);
    ctx.fillStyle = g;
    ctx.fillRect(x, y, w, h);
    // Soft spotlight instead of a title (the title is drawn below the poster).
    const glow = ctx.createRadialGradient(
      x + w * 0.3,
      y + h * 0.2,
      10,
      x + w * 0.3,
      y + h * 0.2,
      w,
    );
    glow.addColorStop(0, `hsl(${hue} 70% 60% / 0.55)`);
    glow.addColorStop(1, 'transparent');
    ctx.fillStyle = glow;
    ctx.fillRect(x, y, w, h);
  }
  ctx.restore();
}

/** Draws the shareable result card and returns it as a PNG blob. */
export async function renderShareCard(
  results: GameResults,
  players: PlayerPublic[],
  text: ShareCardText,
): Promise<Blob> {
  const movie = results.winner?.movie ?? results.alternative;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas unsupported');
  await document.fonts?.ready;

  // Background: dark stage with a warm spotlight.
  ctx.fillStyle = '#0b0910';
  ctx.fillRect(0, 0, W, H);
  const spot = ctx.createRadialGradient(W / 2, -100, 50, W / 2, 0, 900);
  spot.addColorStop(0, 'rgba(242,193,78,0.35)');
  spot.addColorStop(1, 'rgba(242,193,78,0)');
  ctx.fillStyle = spot;
  ctx.fillRect(0, 0, W, H);
  // Curtains
  for (const side of [0, 1]) {
    const g = ctx.createLinearGradient(side ? W : 0, 0, side ? W - 90 : 90, 0);
    g.addColorStop(0, 'rgba(158,31,58,0.9)');
    g.addColorStop(1, 'rgba(158,31,58,0)');
    ctx.fillStyle = g;
    ctx.fillRect(side ? W - 90 : 0, 0, 90, H);
  }

  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#f2c14e';
  ctx.font = '700 34px "Inter Variable", system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(text.heading.toLocaleUpperCase(), W / 2, 110);

  const posterW = 520;
  const posterH = 780;
  if (movie) await drawPoster(ctx, movie, (W - posterW) / 2, 150, posterW, posterH);

  ctx.fillStyle = '#ffffff';
  ctx.font = '800 64px "Bricolage Grotesque Variable", system-ui, sans-serif';
  const titleLines = wrap(ctx, movie?.title ?? '', W - 200, 2);
  titleLines.forEach((l, i) => ctx.fillText(l, W / 2, 1010 + i * 72));
  let y = 1010 + titleLines.length * 72;

  ctx.fillStyle = '#c9bfd6';
  ctx.font = '600 32px "Inter Variable", system-ui, sans-serif';
  ctx.fillText(text.meta, W / 2, y);
  y += 60;

  if (text.agreement) {
    const likers = results.winner?.likedBy
      .map((id) => players.find((p) => p.id === id)?.avatar)
      .filter(Boolean)
      .join(' ');
    ctx.fillStyle = '#3ddc97';
    ctx.font = '700 36px "Inter Variable", system-ui, sans-serif';
    ctx.fillText(`${text.agreement}  ${likers ?? ''}`, W / 2, y);
  }

  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.font = '600 26px "Inter Variable", system-ui, sans-serif';
  ctx.fillText(text.footer, W / 2, H - 70);
  ctx.font = '400 18px "Inter Variable", system-ui, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  ctx.fillText(text.attribution, W / 2, H - 36);

  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/png'),
  );
}

/** Shares via the Web Share API when files are supported, otherwise downloads. */
export async function shareOrDownload(
  blob: Blob,
  filename: string,
  preferShare: boolean,
): Promise<void> {
  const file = new File([blob], filename, { type: 'image/png' });
  if (preferShare && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file] });
      return;
    } catch {
      /* cancelled → fall back to download */
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

export function slug(s: string): string {
  return (
    s
      .toLocaleLowerCase('tr')
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/ı/g, 'i')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 40) || 'film'
  );
}
