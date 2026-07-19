import type { LucideIcon } from "lucide-react";

interface Props {
  label: string;
  value: string | number;
  icon?: LucideIcon;
  hint?: string;
  tone?: "default" | "success" | "warning";
}

export function DashboardCard({ label, value, icon: Icon, hint, tone = "default" }: Props) {
  void Icon;
  return (
    <div className="app-metric" data-tone={tone}>
      <div className="app-metric__label">{label}</div>
      <div className="app-metric__value">{value}</div>
      {hint && <div className="app-metric__hint">{hint}</div>}
    </div>
  );
}
