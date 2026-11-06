import { useState, type CSSProperties } from 'react';
import type { Movie } from '@ortak-perde/shared';

/**
 * Movie poster with a skeleton while loading and a generated gradient placeholder when there
 * is no poster (sample data) or the image fails.
 */
export function Poster({
  movie,
  className = '',
  showTitle = true,
  eager = false,
}: {
  movie: Movie;
  className?: string;
  showTitle?: boolean;
  eager?: boolean;
}) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const hue = movie.placeholderHue ?? (movie.id * 47) % 360;
  const usePlaceholder = !movie.posterUrl || failed;

  return (
    <div
      className={`relative overflow-hidden bg-ink-700 [container-type:inline-size] ${className}`}
    >
      {usePlaceholder ? (
        <div
          className="poster-placeholder absolute inset-0 flex items-end p-[8%]"
          style={{ '--hue': hue } as CSSProperties}
          aria-hidden="true"
        >
          {showTitle && (
            <span className="font-display text-[clamp(1rem,7cqw,2.5rem)] font-extrabold leading-tight text-white/90 drop-shadow">
              {movie.title}
            </span>
          )}
        </div>
      ) : (
        <>
          {!loaded && <div className="skeleton absolute inset-0" aria-hidden="true" />}
          <img
            src={movie.posterUrl!}
            alt=""
            draggable={false}
            loading={eager ? 'eager' : 'lazy'}
            decoding="async"
            onLoad={() => setLoaded(true)}
            onError={() => setFailed(true)}
            className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-300 ${
              loaded ? 'opacity-100' : 'opacity-0'
            }`}
          />
        </>
      )}
    </div>
  );
}
