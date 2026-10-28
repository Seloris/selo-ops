import { createBrowserRouter } from "react-router";
import { AppLayout } from "./features/app/pages/AppLayout.tsx";

// One lazy route per feature page, all under the shared header (app FR-03). app FR-01: the home address opens Sessions live.
export const router = createBrowserRouter([
  {
    Component: AppLayout,
    children: [
      {
        index: true,
        lazy: async () => ({ Component: (await import("./features/sessions/pages/SessionsLivePage.tsx")).SessionsLivePage }),
      },
      {
        path: "projects",
        lazy: async () => ({ Component: (await import("./features/projects/pages/ProjectsPage.tsx")).ProjectsPage }),
      },
      {
        path: "stats",
        lazy: async () => ({ Component: (await import("./features/stats/pages/StatsPage.tsx")).StatsPage }),
      },
      {
        path: "help",
        lazy: async () => ({ Component: (await import("./features/help/pages/HelpPage.tsx")).HelpPage }),
      },
    ],
  },
]);
