import { ConstructionIcon } from 'lucide-react';
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';

/**
 * Stub for routes that exist in the navigation map but have not been built yet.
 * Wiring them now means the sidebar and deep links never dead-end on a blank
 * screen while later slices land.
 */
export function Placeholder({ title, slice }: { title: string; slice?: string }) {
  return (
    <Empty className="min-h-[60svh]">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <ConstructionIcon aria-hidden="true" />
        </EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>
          This screen has not been built yet{slice ? ` — it lands in ${slice}.` : '.'}
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent />
    </Empty>
  );
}
