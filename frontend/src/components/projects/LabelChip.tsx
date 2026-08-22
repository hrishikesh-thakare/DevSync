import { useLabelStore } from '../../store/labelStore.js';
import { DEFAULT_LABEL_COLOR, assertContrast, readableText } from '@/theme/colors';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

/**
 * A label color is one of the two runtime values AGENTS.md §2 allows through an
 * inline style — it comes from the database and cannot be a token. It must not
 * be painted raw: `assertContrast` lifts it until the chip clears 3:1 against
 * `--bg-surface`, and `readableText` picks the text token that clears 4.5:1 on
 * the result (§10, "Don't render a DB-supplied label colour raw").
 */
export const LabelChip = ({ name, onRemove }: { name: string; onRemove?: () => void }) => {
  const raw = useLabelStore((state) => state.colorByName[name]) || DEFAULT_LABEL_COLOR;
  const color = assertContrast(raw);
  const fg = readableText(color);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className="inline-flex items-center text-micro px-1.5 py-0 rounded-full"
          style={{ backgroundColor: color, color: fg }}
        >
          {name}
          {onRemove && (
            <button
              onClick={onRemove}
              className="ml-1 text-current transition-colors duration-[--duration-fast]"
              aria-label={`Remove label ${name}`}
            >
              ×
            </button>
          )}
        </span>
      </TooltipTrigger>
      <TooltipContent>{name}</TooltipContent>
    </Tooltip>
  );
};
