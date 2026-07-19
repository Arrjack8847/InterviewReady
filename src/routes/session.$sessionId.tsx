import { createFileRoute, Link } from "@tanstack/react-router";
import { RequireAuth } from "@/components/RequireAuth";
import { ErrorState } from "@/components/app/ErrorState";
import { LoadingState } from "@/components/app/LoadingState";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";
import { InterviewReport } from "@/features/report/components/InterviewReport";
import { useInterviewReport } from "@/features/report/useInterviewReport";

export const Route = createFileRoute("/session/$sessionId")({
  head: () => ({
    meta: [
      { title: "Saved Interview Report — InterviewReady" },
      {
        name: "description",
        content: "Review a saved interview report, answer feedback, and next practice steps.",
      },
    ],
  }),
  component: () => (
    <RequireAuth>
      <SavedReportPage />
    </RequireAuth>
  ),
});

function SavedReportPage() {
  const { sessionId } = Route.useParams();
  const { user } = useAuth();
  const report = useInterviewReport({ source: "saved", sessionId, userId: user?.uid });

  if (report.status === "loading") {
    return (
      <LoadingState
        fullPage
        title="Loading your saved report"
        description="Retrieving the session, answers, feedback, and available coaching measurements."
      />
    );
  }

  if (report.status === "error" || report.status === "empty") {
    return (
      <div className="app-container py-16">
        <ErrorState
          title="This report is unavailable"
          description={
            report.status === "error"
              ? report.error
              : "The session does not contain report data that can be displayed."
          }
          action={
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button onClick={report.retry}>Try again</Button>
              <Button asChild variant="outline">
                <Link to="/history">Back to preparation journal</Link>
              </Button>
            </div>
          }
        />
      </div>
    );
  }

  return <InterviewReport report={report.viewModel} />;
}
