import { cn } from '@/lib/utils';

/**
 * The DevSync mark: three ascending board columns, the tallest doubling as a
 * chat bubble.
 *
 * Hand-drawn on a 24-unit grid rather than imported as an image, for three
 * reasons that all bite eventually:
 *
 *  - It inherits `currentColor`, so the mark is crimson on the landing page and
 *    white inside a `bg-primary` tile without shipping two files that can drift.
 *  - It stays sharp at any size, including the 20px header instance, where a
 *    raster would either blur or need a 2x/3x set.
 *  - There is no generator watermark to leak into production. The supplied
 *    `Gemini_Generated_Image_*.png` has one in its lower-right corner.
 *
 * Geometry note: the columns sit on a shared baseline while the bubble floats
 * above it, so the tail has somewhere to point. That gap is the difference
 * between reading as "a bar chart" and reading as "a board plus a conversation".
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={cn('size-6', className)}
      aria-hidden="true"
    >
      <rect x="2.5" y="13" width="5" height="8" rx="1.3" />
      <rect x="9" y="8" width="5" height="13" rx="1.3" />
      <rect x="15.5" y="2.5" width="5" height="13" rx="1.4" />
      <path d="M16.6 14v6.2L20 14z" />
    </svg>
  );
}

/**
 * Mark plus wordmark. `DevSync` is set as one word with a tighter tracking than
 * body copy — a lockup reads as a name, not a sentence.
 */
export function Logo({
  className,
  markClassName,
}: {
  className?: string;
  markClassName?: string;
}) {
  return (
    <span className={cn('flex items-center gap-2', className)}>
      <LogoMark className={cn('size-6 text-primary', markClassName)} />
      <span className="text-[15px] font-semibold tracking-[-0.02em] text-foreground">DevSync</span>
    </span>
  );
}
