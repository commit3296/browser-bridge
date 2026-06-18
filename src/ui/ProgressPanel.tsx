import { ProgressEvent } from "../shared/types";

export function ProgressPanel({ progress }: { progress: ProgressEvent | null }) {
  if (!progress) return null;

  const percent =
    progress.total > 0 ? Math.min(100, Math.round((progress.completed / progress.total) * 100)) : 0;

  return (
    <div className="rounded-md border bg-card p-3">
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="font-medium">{progress.message}</span>
        <span className="text-muted-foreground">{percent}%</span>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-200 ease-out"
          style={{ width: `${percent}%` }}
        />
      </div>
      <div className="mt-2 text-xs text-muted-foreground">
        {progress.completed} / {progress.total}
        {progress.section ? ` · ${progress.section}` : ""}
      </div>
    </div>
  );
}
