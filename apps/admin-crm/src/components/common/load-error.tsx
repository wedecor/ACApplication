export function LoadError({ label, message }: { label: string; message?: string }) {
  return (
    <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
      Failed to load {label}.
      {message ? ` ${message}` : null}
    </div>
  );
}
