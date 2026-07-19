import type { ReactNode } from "react";

type PageHeaderProps = {
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
};

export function PageHeader({ eyebrow, title, description, actions }: PageHeaderProps) {
  return (
    <header className="app-page-header">
      <div className="app-page-header__copy">
        {eyebrow && <p className="app-eyebrow">{eyebrow}</p>}
        <h1>{title}</h1>
        {description && <p className="app-page-description">{description}</p>}
      </div>
      {actions && <div className="app-page-header__actions">{actions}</div>}
    </header>
  );
}
