import { Button } from '@/components/ui/button';

export function Pager({
  page,
  totalPages,
  totalCount,
  onPage,
}: {
  page: number;
  totalPages: number;
  totalCount: number;
  onPage: (page: number) => void;
}) {
  if (totalCount === 0 || totalPages <= 1) return null;
  return (
    <div className="mt-4 flex items-center justify-between p-4 pt-0">
      <p className="text-xs text-muted-foreground">
        Page {page} of {totalPages} &middot; {totalCount} total
      </p>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>
          Previous
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={page >= totalPages}
          onClick={() => onPage(page + 1)}
        >
          Next
        </Button>
      </div>
    </div>
  );
}
