import { createBrowserRouter } from "react-router";

// One lazy route per feature page. app FR-01: the home address opens Sessions live.
export const router = createBrowserRouter([
  {
    path: "/",
    lazy: async () => ({ Component: (await import("./features/sessions/pages/SessionsLivePage.tsx")).SessionsLivePage }),
  },
  {
    path: "/help",
    lazy: async () => ({ Component: (await import("./features/help/pages/HelpPage.tsx")).HelpPage }),
  },
]);
