import { forwardRef, useEffect, useImperativeHandle, useState } from 'react';

interface MentionItem {
  id: string;
  label: string;
}

/**
 * The subset of TipTap's suggestion render props this list actually reads.
 * TipTap passes more (`editor`, `range`, `clientRect`, …); declaring only what
 * is used keeps the contract honest without importing the plugin's types.
 */
interface MentionListProps {
  items: MentionItem[];
  command: (item: MentionItem) => void;
}

const MentionList = forwardRef((props: MentionListProps, ref) => {
  const [selectedIndex, setSelectedIndex] = useState(0);

  const selectItem = (index: number) => {
    const item = props.items[index];

    if (item) {
      props.command({ id: item.id, label: item.label });
    }
  };

  const upHandler = () => {
    setSelectedIndex((selectedIndex + props.items.length - 1) % props.items.length);
  };

  const downHandler = () => {
    setSelectedIndex((selectedIndex + 1) % props.items.length);
  };

  const enterHandler = () => {
    selectItem(selectedIndex);
  };

  useEffect(() => setSelectedIndex(0), [props.items]);

  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }: { event: KeyboardEvent }) => {
      if (event.key === 'ArrowUp') {
        upHandler();
        return true;
      }

      if (event.key === 'ArrowDown') {
        downHandler();
        return true;
      }

      if (event.key === 'Enter') {
        enterHandler();
        return true;
      }

      return false;
    },
  }));

  if (!props.items || props.items.length === 0) {
    return (
      <div className="bg-card border border-border rounded-lg shadow-md p-2 text-sm text-subtle-foreground">
        No results
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-lg shadow-md overflow-y-auto max-h-60 py-1 min-w-[150px]">
      {props.items.map((item: MentionItem, index: number) => (
        <button
          className={`w-full text-left px-4 py-2 text-sm transition-colors ${
            index === selectedIndex ? 'bg-accent text-accent-foreground' : 'text-foreground hover:bg-hover'
          }`}
          key={index}
          onClick={() => selectItem(index)}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
});

MentionList.displayName = 'MentionList';

export default MentionList;
