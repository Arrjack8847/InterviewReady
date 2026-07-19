import { createFileRoute } from "@tanstack/react-router";

import { HomePage } from "@/components/home/HomePage";
import "@/components/home/homepage.css";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "InterviewReady — Personalised AI Interview Preparation" },
      {
        name: "description",
        content:
          "Turn your résumé into personalised interview questions, realistic practice and specific AI feedback.",
      },
      { property: "og:title", content: "InterviewReady" },
      {
        property: "og:description",
        content: "Personalised interview preparation built around your experience.",
      },
    ],
  }),
  component: HomePage,
});
