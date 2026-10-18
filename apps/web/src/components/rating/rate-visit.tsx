'use client';

import { Button, Label, Spinner } from '@ac/ui';
import { CheckCircle2, Star } from 'lucide-react';
import { useEffect, useId, useState } from 'react';

import { ApiClientError,apiFetch } from '@/lib/api-client';
import { formatQuoteDate } from '@/lib/quotation';

interface RatingView {
  bookingCode: string;
  service: string;
  completedAt: string | null;
  technicianFirstName: string | null;
  rated: boolean;
  canRate: boolean;
}

const LABELS = ['Very poor', 'Poor', 'Okay', 'Good', 'Excellent'] as const;

type State =
  | { kind: 'loading' }
  | { kind: 'invalid' }
  | { kind: 'error' }
  | { kind: 'ready'; view: RatingView }
  | { kind: 'thanks' };

/** Public "rate your visit" form behind a signed link. */
export function RateVisit({ token }: { token: string }) {
  const [state, setState] = useState<State>({ kind: 'loading' });
  const [value, setValue] = useState(0);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const commentId = useId();
  const path = `/public/ratings/${encodeURIComponent(token)}`;

  useEffect(() => {
    let live = true;
    apiFetch<RatingView>(path)
      .then((view) => live && setState({ kind: 'ready', view }))
      .catch((err: unknown) => {
        if (live) setState({ kind: err instanceof ApiClientError && err.status === 404 ? 'invalid' : 'error' });
      });
    return () => {
      live = false;
    };
  }, [path]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!value) {
      setSubmitError('Choose a star rating first.');
      return;
    }
    setBusy(true);
    setSubmitError(null);
    try {
      await apiFetch(path, { method: 'POST', body: { value, comment: comment.trim() || undefined } });
      setState({ kind: 'thanks' });
    } catch (err) {
      setSubmitError(
        err instanceof ApiClientError && err.status === 409
          ? 'This visit has already been rated. Thank you!'
          : 'We couldn’t save your rating. Check your connection and try again.',
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-8 sm:px-6 sm:py-12">
      {state.kind === 'loading' ? (
        <div className="flex min-h-[40vh] items-center justify-center" role="status" aria-label="Loading">
          <Spinner />
        </div>
      ) : state.kind === 'invalid' || state.kind === 'error' ? (
        <>
          <h1 className="text-2xl font-bold tracking-tight">
            {state.kind === 'invalid' ? 'This link isn’t valid' : 'Couldn’t load this page'}
          </h1>
          <p className="mt-2 text-muted-foreground">
            {state.kind === 'invalid'
              ? 'Open the latest message we sent you, or rate the visit in the app.'
              : 'Check your connection and refresh the page.'}
          </p>
        </>
      ) : state.kind === 'thanks' ? (
        <div role="status" className="text-center">
          <CheckCircle2 className="mx-auto size-12 text-success-700 dark:text-success-500" aria-hidden />
          <h1 className="mt-4 text-2xl font-bold tracking-tight">Thanks for your feedback</h1>
          <p className="mt-2 text-muted-foreground">It helps us coach our technicians and improve every visit.</p>
        </div>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            {state.view.service} · {state.view.bookingCode}
            {state.view.completedAt ? ` · ${formatQuoteDate(state.view.completedAt)}` : ''}
          </p>
          <h1 className="mt-1 text-balance text-2xl font-bold tracking-tight sm:text-3xl">
            {state.view.technicianFirstName ? `How did ${state.view.technicianFirstName} do?` : 'How was your visit?'}
          </h1>
          {!state.view.canRate ? (
            <p className="mt-4 text-muted-foreground">
              {state.view.rated
                ? 'This visit has already been rated. Thank you!'
                : 'You can rate this visit once the job is marked complete.'}
            </p>
          ) : (
            <form onSubmit={(e) => void submit(e)} className="mt-6 space-y-6">
              <fieldset>
                <legend className="text-sm font-medium">Your rating</legend>
                <div className="mt-2 flex gap-1" role="radiogroup">
                  {LABELS.map((label, i) => {
                    const n = i + 1;
                    const on = n <= value;
                    return (
                      <button
                        key={n}
                        type="button"
                        role="radio"
                        aria-checked={value === n}
                        aria-label={`${n} star${n > 1 ? 's' : ''}, ${label}`}
                        onClick={() => setValue(n)}
                        className="grid size-12 place-items-center rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <Star
                          className={`size-9 ${on ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground'}`}
                          aria-hidden
                        />
                      </button>
                    );
                  })}
                </div>
                <p className="mt-1 h-5 text-sm text-muted-foreground" aria-live="polite">
                  {value ? LABELS[value - 1] : ''}
                </p>
              </fieldset>
              <div className="space-y-2">
                <Label htmlFor={commentId}>Anything to add? (optional)</Label>
                <textarea
                  id={commentId}
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  maxLength={2000}
                  rows={4}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>
              {submitError ? (
                <p role="alert" className="text-sm text-danger-700 dark:text-danger-500">
                  {submitError}
                </p>
              ) : null}
              <Button type="submit" size="lg" fullWidth disabled={busy}>
                {busy ? 'Sending…' : 'Submit rating'}
              </Button>
            </form>
          )}
        </>
      )}
    </div>
  );
}
