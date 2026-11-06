import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { useTranslation } from 'react-i18next';
import { displayJoinHint } from '@ortak-perde/shared';

/**
 * Big, high-contrast QR code for the TV screen plus the manual fallback
 * ("can't scan? open <host>/join and type ABCD"). Never encodes localhost: when no
 * phone-reachable address is known it shows a warning instead.
 */
export function JoinQr({
  joinUrl,
  joinBase,
  code,
}: {
  joinUrl: string | null;
  joinBase: string | null;
  code: string;
}) {
  const { t } = useTranslation();
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!joinUrl) {
      setDataUrl(null);
      return;
    }
    let alive = true;
    QRCode.toDataURL(joinUrl, {
      errorCorrectionLevel: 'M',
      margin: 2,
      width: 720,
      color: { dark: '#07060a', light: '#ffffff' },
    })
      .then((url) => alive && setDataUrl(url))
      .catch(() => alive && setDataUrl(null));
    return () => {
      alive = false;
    };
  }, [joinUrl]);

  const hint = displayJoinHint(joinBase);

  return (
    <div className="flex flex-col items-center gap-5">
      <div className="rounded-[2rem] bg-white p-3 shadow-glow">
        {joinUrl && dataUrl ? (
          <img
            src={dataUrl}
            alt={t('host.qrAlt', { url: joinUrl })}
            data-testid="join-qr"
            data-url={joinUrl}
            className="aspect-square w-[min(38vh,26rem)] [image-rendering:pixelated]"
          />
        ) : (
          <div className="flex aspect-square w-[min(38vh,26rem)] items-center justify-center p-6 text-center text-lg font-semibold text-ink-900">
            {joinUrl ? '…' : t('host.noLanAddress')}
          </div>
        )}
      </div>
      <div className="text-center">
        <p className="label">{t('host.roomCode')}</p>
        <p
          className="font-display text-7xl font-extrabold tracking-[0.25em] text-spot xl:text-8xl"
          data-testid="room-code"
        >
          {code}
        </p>
        {hint && (
          <p className="mt-2 text-lg text-mist">
            {t('host.manualJoin')} <span className="font-semibold text-white">{hint}</span> ·{' '}
            {t('host.manualCode')} <span className="font-semibold text-white">{code}</span>
          </p>
        )}
      </div>
    </div>
  );
}
