import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/admin")({
  beforeLoad: () => {
    throw redirect({ to: "/console", replace: true });
  },
  head: () => ({
    meta: [
      { title: "Admin console | Universal API" },
      { name: "description", content: "Admin console for Universal API operators and results." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => null,
});
