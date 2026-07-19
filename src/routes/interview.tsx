import { createFileRoute } from "@tanstack/react-router";

import { RequireAuth } from "@/components/RequireAuth";
import { InterviewRoom } from "@/features/interview/InterviewRoom";

export const Route = createFileRoute("/interview")({
  head: () => ({
    meta: [
      { title: "Interview Room — InterviewReady AI" },
      {
        name: "description",
        content: "Live interview practice room with AI feedback after each answer.",
      },
      { property: "og:title", content: "Interview Room" },
      {
        property: "og:description",
        content: "Practice an AI interview in real time.",
      },
    ],
  }),
  component: () => (
    <RequireAuth>
      <InterviewRoom />
    </RequireAuth>
  ),
});
