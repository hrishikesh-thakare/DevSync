import { useLabelStore } from '../../store/labelStore.js';
import { useTheme } from '@/theme/ThemeProvider';
import { DEFAULT_LABEL_COLOR, assertContrast, readableText } from '@/theme/colors';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

export const LabelChip = ({ name, onRemove }: { name: string; onRemove?: () => void }) => {
  const { mode } = useTheme();
  const raw = useLabelStore((state) => state.colorByName[name]) || DEFAULT_LABEL_COLOR;
  // DB-provided colors are clamped to guarantee WCAG AA text contrast in the
  // active mode; the label text is read from the same source (colors.ts).
  const color = assertContrast(raw, mode);
  const fg = readableText(color);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className="inline-flex items-center text-micro px-1.5 py-0 rounded border"
          style={{ backgroundColor: color, borderColor: color, color: fg }}
        >
          {name}
          {onRemove && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button onClick={onRemove} className="ml-1 text-current opacity-60 hover:opacity-100" aria-label={`Remove ${name}`}>
                  ×
                </button>
              </TooltipTrigger>
              <TooltipContent>{`Remove ${name}`}</TooltipContent>
            </Tooltip>
          )}
        </span>
      </TooltipTrigger>
      <TooltipContent>{name}</TooltipContent>
    </Tooltip>
  );
};