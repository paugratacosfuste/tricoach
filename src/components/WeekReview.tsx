// src/components/WeekReview.tsx
//
// PURPOSE: End-of-week feedback form.
// Collects how the athlete felt, any issues, and constraints for next week.
// This data is sent to Claude to adapt the next week's plan.

import React, { useState } from 'react';
import { WeekFeedback, WeekFeeling, WeekPlan } from '@/types/training';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Frown, Meh, Smile, SmilePlus, Flame, AlertTriangle, Loader2 } from 'lucide-react';

// ============================================
// TYPES
// ============================================

interface WeekReviewProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (feedback: WeekFeedback, constraints?: string) => Promise<void>;
  currentWeek: WeekPlan;
  isLoading?: boolean;
}

interface FeelingOption {
  value: WeekFeeling;
  label: string;
  icon: React.ReactNode;
  color: string;
}

// ============================================
// CONSTANTS
// ============================================

const FEELING_OPTIONS: FeelingOption[] = [
  {
    value: 'struggling',
    label: 'Struggling',
    icon: <Frown className="w-6 h-6" />,
    color: 'text-red-500 border-red-500 bg-red-500/10',
  },
  {
    value: 'tired',
    label: 'Tired',
    icon: <Meh className="w-6 h-6" />,
    color: 'text-orange-500 border-orange-500 bg-orange-500/10',
  },
  {
    value: 'okay',
    label: 'Okay',
    icon: <Smile className="w-6 h-6" />,
    color: 'text-yellow-500 border-yellow-500 bg-yellow-500/10',
  },
  {
    value: 'good',
    label: 'Good',
    icon: <SmilePlus className="w-6 h-6" />,
    color: 'text-green-500 border-green-500 bg-green-500/10',
  },
  {
    value: 'great',
    label: 'Great',
    icon: <Flame className="w-6 h-6" />,
    color: 'text-emerald-500 border-emerald-500 bg-emerald-500/10',
  },
];

const PHYSICAL_ISSUES = [
  { id: 'none', label: 'No issues' },
  { id: 'general-fatigue', label: 'General fatigue (normal training load)' },
  { id: 'muscle-soreness', label: 'Muscle soreness' },
  { id: 'knee-discomfort', label: 'Knee discomfort' },
  { id: 'ankle-foot', label: 'Ankle/foot issue' },
  { id: 'hip-glute', label: 'Hip/glute tightness' },
  { id: 'back-pain', label: 'Back pain' },
  { id: 'shoulder-arm', label: 'Shoulder/arm issue (swim-related)' },
  { id: 'illness', label: 'Feeling unwell / cold symptoms' },
  { id: 'sleep-issues', label: 'Poor sleep quality' },
  { id: 'other', label: 'Other (describe in notes)' },
];

// Phase 1.E.3 — server `sanitizePromptInput` truncates at 500. Keep the
// UI cap in lock-step so the user sees the limit before submission.
const MAX_FREETEXT_LEN = 500;

// ============================================
// COMPONENT
// ============================================

export function WeekReview({
  isOpen,
  onClose,
  onSubmit,
  currentWeek,
  isLoading = false,
}: WeekReviewProps) {
  const [feeling, setFeeling] = useState<WeekFeeling | null>(null);
  const [selectedIssues, setSelectedIssues] = useState<string[]>(['none']);
  const [notes, setNotes] = useState('');
  const [constraints, setConstraints] = useState('');

  // Calculate completion stats
  const totalWorkouts = currentWeek.workouts.filter((w) => w.type !== 'rest').length;
  const completedWorkouts = currentWeek.workouts.filter((w) => w.status === 'completed').length;
  const completionRate = totalWorkouts > 0 ? Math.round((completedWorkouts / totalWorkouts) * 100) : 0;

  const handleIssueToggle = (issueId: string) => {
    if (issueId === 'none') {
      // If selecting "none", clear all other selections
      setSelectedIssues(['none']);
    } else {
      // Remove "none" if selecting an actual issue
      const withoutNone = selectedIssues.filter((i) => i !== 'none');
      if (selectedIssues.includes(issueId)) {
        const newIssues = withoutNone.filter((i) => i !== issueId);
        setSelectedIssues(newIssues.length === 0 ? ['none'] : newIssues);
      } else {
        setSelectedIssues([...withoutNone, issueId]);
      }
    }
  };

  const handleSubmit = async () => {
    if (!feeling) return;

    const feedback: WeekFeedback = {
      overallFeeling: feeling,
      physicalIssues: selectedIssues.filter((i) => i !== 'none'),
      notes: notes.trim(),
      nextWeekConstraints: constraints.trim() || undefined,
    };

    await onSubmit(feedback, constraints.trim() || undefined);
    
    // Reset form
    setFeeling(null);
    setSelectedIssues(['none']);
    setNotes('');
    setConstraints('');
  };

  const isValid = feeling !== null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Week {currentWeek.weekNumber} Review
          </DialogTitle>
          <DialogDescription>
            Tell us how your week went so we can adapt your next week's training.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Completion Summary */}
          <div className="bg-muted/50 rounded-lg p-4">
            <div className="text-sm text-muted-foreground mb-1">Week Summary</div>
            <div className="flex items-center justify-between">
              <span className="font-medium">{currentWeek.theme}</span>
              <span className={`font-bold ${completionRate >= 80 ? 'text-green-500' : completionRate >= 50 ? 'text-yellow-500' : 'text-red-500'}`}>
                {completedWorkouts}/{totalWorkouts} workouts ({completionRate}%)
              </span>
            </div>
          </div>

          {/* Overall Feeling */}
          <div>
            <label className="text-sm font-medium mb-3 block">
              How did this week feel overall? *
            </label>
            <div className="grid grid-cols-5 gap-2">
              {FEELING_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setFeeling(option.value)}
                  className={`flex flex-col items-center justify-center p-3 rounded-lg border-2 transition-all ${
                    feeling === option.value
                      ? option.color
                      : 'border-border hover:border-muted-foreground/50'
                  }`}
                >
                  {option.icon}
                  <span className="text-xs mt-1">{option.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Physical Issues */}
          <div>
            <label className="text-sm font-medium mb-3 block">
              Any physical issues this week?
            </label>
            <div className="space-y-2 max-h-[200px] overflow-y-auto pr-2">
              {PHYSICAL_ISSUES.map((issue) => (
                <div key={issue.id} className="flex items-center space-x-2">
                  <Checkbox
                    id={issue.id}
                    checked={selectedIssues.includes(issue.id)}
                    onCheckedChange={() => handleIssueToggle(issue.id)}
                  />
                  <label
                    htmlFor={issue.id}
                    className="text-sm cursor-pointer leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    {issue.label}
                  </label>
                </div>
              ))}
            </div>
          </div>

          {/* Notes */}
          {/* Phase 1.E.3 — server `sanitizePromptInput` truncates at 500
              regardless; cap the textarea so the user sees the limit. */}
          <div>
            <label htmlFor="notes" className="text-sm font-medium mb-2 block">
              Additional notes (optional)
            </label>
            <Textarea
              id="notes"
              placeholder="Any other feedback about this week's training..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              maxLength={MAX_FREETEXT_LEN}
            />
            <p
              className={`text-xs mt-1 text-right ${
                notes.length >= MAX_FREETEXT_LEN
                  ? 'text-red-500'
                  : 'text-muted-foreground'
              }`}
            >
              {notes.length} / {MAX_FREETEXT_LEN}
            </p>
          </div>

          {/* Next Week Constraints */}
          <div className="border-t pt-4">
            <label htmlFor="constraints" className="text-sm font-medium mb-2 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-yellow-500" />
              Anything affecting next week?
            </label>
            <Textarea
              id="constraints"
              placeholder="e.g., 'Busy work week - can only train 4 days', 'Traveling Tuesday-Thursday', 'Want to focus more on running'..."
              value={constraints}
              onChange={(e) => setConstraints(e.target.value)}
              rows={2}
              maxLength={MAX_FREETEXT_LEN}
            />
            <div className="flex items-center justify-between text-xs mt-1">
              <span className="text-muted-foreground">
                We'll adapt your next week's plan based on this.
              </span>
              <span
                className={
                  constraints.length >= MAX_FREETEXT_LEN
                    ? 'text-red-500'
                    : 'text-muted-foreground'
                }
              >
                {constraints.length} / {MAX_FREETEXT_LEN}
              </span>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!isValid || isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Generating Next Week...
              </>
            ) : (
              'Complete Week & Generate Next'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}