type LoadingStateProps = { title?: string; description?: string; fullPage?: boolean };

export function LoadingState({
  title = "Loading your workspace",
  description = "This should only take a moment.",
  fullPage = false,
}: LoadingStateProps) {
  return (
    <div
      className={fullPage ? "app-state app-state--full" : "app-state"}
      role="status"
      aria-live="polite"
    >
      <span className="app-state__loader" aria-hidden="true" />
      <h2>{title}</h2>
      <p>{description}</p>
    </div>
  );
}
