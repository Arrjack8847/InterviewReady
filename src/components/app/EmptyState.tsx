import type { ReactNode } from "react";

type EmptyStateProps = { title: string; description: string; action?: ReactNode };

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="app-state app-state--empty">
      <span className="app-state__rule" aria-hidden="true" />
      <h2>{title}</h2>
      <p>{description}</p>
      {action && <div className="app-state__action">{action}</div>}
    </div>
  );
}
