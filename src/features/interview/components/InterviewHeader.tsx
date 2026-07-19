import {
  Briefcase,
  Building2,
  FileText,
  GraduationCap,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { ExtendedInterviewSetup } from "../types";

interface InterviewHeaderProps {
  setup: ExtendedInterviewSetup;
  modeLabel: string;
  hasSession: boolean;
  onExit: () => void;
}

export function InterviewHeader({
  setup,
  modeLabel,
  hasSession,
  onExit,
}: InterviewHeaderProps) {
  const selectedRole =
    setup.targetRole ||
    setup.role ||
    "No role selected";

  return (
    <div className="app-panel mb-4 flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-wrap items-center gap-2">
        <Badge
          variant="secondary"
          className="gap-1.5 px-3 py-1"
        >
          <Building2 className="h-3.5 w-3.5" />
          {setup.targetCompany || "No company"}
        </Badge>

        <Badge
          variant="secondary"
          className="gap-1.5 px-3 py-1"
        >
          <Briefcase className="h-3.5 w-3.5" />
          {selectedRole}
        </Badge>

        <Badge
          variant="secondary"
          className="px-3 py-1"
        >
          {setup.type}
        </Badge>

        <Badge
          variant="outline"
          className="gap-1.5 px-3 py-1.5"
        >
          <GraduationCap className="h-3.5 w-3.5" />
          Experience Level: {setup.difficulty}
        </Badge>

        <Badge
          variant="outline"
          className="px-3 py-1.5"
        >
          {modeLabel}
        </Badge>

        {setup.resume?.fileName && (
          <Badge
            variant="outline"
            className="gap-1.5 px-3 py-1.5"
          >
            <FileText className="h-3.5 w-3.5" />
            {setup.resume.fileName}
          </Badge>
        )}

        {hasSession && (
          <Badge
            variant="outline"
            className="px-3 py-1.5"
          >
            Saved session
          </Badge>
        )}
      </div>

      <Button
        type="button"
        variant="outline"
        onClick={onExit}
        className="border-foreground/30"
      >
        Exit to Dashboard
      </Button>
    </div>
  );
}