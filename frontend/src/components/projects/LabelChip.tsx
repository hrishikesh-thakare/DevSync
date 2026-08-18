import { useLabelStore } from '../../store/labelStore.js';

const DEFAULT_COLOR = '#64748b';

export const LabelChip = ({ name, onRemove }: { name: string; onRemove?: () => void }) => {
  const color = useLabelStore((state) => state.colorByName[name]) || DEFAULT_COLOR;

  return (
    <span
      className="inline-flex items-center text-[10px] px-1.5 py-0 rounded border text-gray-200"
      style={{ backgroundColor: `${color}22`, borderColor: `${color}66`, color }}
      title={name}
    >
      {name}
      {onRemove && (
        <button onClick={onRemove} className="ml-1 text-current opacity-60 hover:opacity-100" title={`Remove ${name}`}>
          ×
        </button>
      )}
    </span>
  );
};