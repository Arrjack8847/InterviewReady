import type { ReactNode } from "react";

type ErrorStateProps = {
  title?: string;
  description: string;
  action?: ReactNode;
  fullPage?: boolean;
};

export function ErrorState({
  title = "Something went wrong",
  description,
  action,
  fullPage = false,
}: ErrorStateProps) {
  return (
    <div
      className={
        fullPage ? "app-state app-state--error app-state--full" : "app-state app-state--error"
      }
      role="alert"
    >
      <span className="app-state__rule" aria-hidden="true" />
      <h2>{title}</h2>
      <p>{description}</p>
      {action && <div className="app-state__action">{action}</div>}
    </div>
  );
}
