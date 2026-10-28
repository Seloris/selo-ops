import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { api, problemMessage } from "../../../api/client.ts";
import type { Filters } from "../ui/statsView.ts";
import { statsKeys } from "./statsKeys.ts";

// stats FR-01: the page reads its figures again every 30 s.
export const REFRESH_MS = 30_000;

// stats FR-02: days are cut in the browser's own zone.
const browserZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

export function useStatsQuery({ period, project }: Filters) {
  const tz = browserZone();
  return useQuery({
    queryKey: statsKeys.read(period, project ?? "", tz),
    queryFn: async () => {
      const { data, error } = await api.GET("/v1/stats", { params: { query: { period, tz, ...(project === null ? {} : { project }) } } });
      if (error !== undefined) throw new Error(problemMessage(error));
      return data;
    },
    // A change of filter keeps the last figures on screen until the new ones come.
    placeholderData: keepPreviousData,
    refetchInterval: REFRESH_MS,
  });
}
