import { useState, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

interface Reaction {
  emoji: string;
  userId: string;
  userName?: string;
}

interface ReactionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  reactions: Reaction[];
  currentUserId: string;
  onRemoveReaction: (emoji: string) => void;
}

export function ReactionsModal({
  isOpen,
  onClose,
  reactions,
  currentUserId,
  onRemoveReaction,
}: ReactionsModalProps) {
  const [activeTab, setActiveTab] = useState<string>('all');

  // Aggregate reactions by emoji
  const aggregated = useMemo(() => {
    const counts = reactions.reduce((acc, rx) => {
      acc[rx.emoji] = (acc[rx.emoji] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(counts).sort((a, b) => b[1] - a[1]); // Sort by count descending
  }, [reactions]);

  // Filter reactions based on active tab
  const displayedReactions = useMemo(() => {
    if (activeTab === 'all') return reactions;
    return reactions.filter(rx => rx.emoji === activeTab);
  }, [reactions, activeTab]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-[340px]">
        <DialogHeader>
          <DialogTitle>{reactions.length} reactions</DialogTitle>
          <DialogDescription>
            People who reacted to this message
          </DialogDescription>
        </DialogHeader>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="w-full justify-start flex-wrap">
            <TabsTrigger value="all" className="flex-none">All</TabsTrigger>
            {aggregated.map(([emoji, count]) => (
              <TabsTrigger key={emoji} value={emoji} className="flex-none">
                {emoji} <span className="text-caption text-muted-foreground ml-1">({count})</span>
              </TabsTrigger>
            ))}
          </TabsList>

          {/* User List */}
          <TabsContent value={activeTab} className="max-h-[60vh] overflow-y-auto">
          {displayedReactions.map((rx, idx) => {
            const isMe = rx.userId === currentUserId;

            return (
              <div
                key={`${rx.userId}-${rx.emoji}-${idx}`}
                className="flex items-center justify-between px-4 py-3 hover:bg-hover transition-colors group"
              >
                <div className="flex items-center space-x-3">
                  <div className="w-9 h-9 rounded-md bg-hover flex items-center justify-center text-foreground font-[590] shadow-md border border-border flex-shrink-0">
                    {(rx.userName?.[0] || 'U').toUpperCase()}
                  </div>
                  <div className="flex flex-col">
                    <span className="text-foreground font-[510]">
                      {isMe ? 'You' : (rx.userName || 'Unknown User')}
                    </span>
                    {isMe && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="justify-start px-0 text-caption text-subtle-foreground hover:text-danger-on-muted"
                        onClick={() => onRemoveReaction(rx.emoji)}
                      >
                        Click to remove
                      </Button>
                    )}
                  </div>
                </div>
                <div className="text-h2" aria-hidden="true">
                  {rx.emoji}
                </div>
              </div>
            );
          })}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}