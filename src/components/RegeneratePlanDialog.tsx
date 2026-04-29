import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Loader2, MessageSquare } from 'lucide-react';

interface RegeneratePlanDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (comment: string) => Promise<void>;
  isLoading?: boolean;
}

const MIN_CHARS = 10;

export function RegeneratePlanDialog({
  isOpen,
  onClose,
  onSubmit,
  isLoading = false,
}: RegeneratePlanDialogProps) {
  const [comment, setComment] = useState('');

  const isValid = comment.trim().length >= MIN_CHARS;

  const handleSubmit = async () => {
    if (!isValid || isLoading) return;
    await onSubmit(comment.trim());
    setComment('');
  };

  const handleClose = () => {
    if (isLoading) return;
    setComment('');
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-primary" />
            Request Plan Change
          </DialogTitle>
          <DialogDescription>
            Tell your AI coach what you'd like to change about your current training plan.
            A new week will be generated based on your feedback.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <Textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="e.g., 'I want more swimming sessions', 'Reduce intensity this week', 'Add a brick workout'..."
            className="min-h-[120px] resize-none"
            disabled={isLoading}
          />
          <p className={`text-xs ${isValid ? 'text-green-500' : 'text-muted-foreground'}`}>
            {comment.trim().length}/{MIN_CHARS} min characters
          </p>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={handleClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!isValid || isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Regenerating...
              </>
            ) : (
              'Regenerate Plan'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
