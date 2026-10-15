import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import { parseSearch, stringifySearch } from "./lib/searchParams";

export const getRouter = () => {
  const queryClient = new QueryClient();

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
    // Keep search values as strings so free text such as `?q=123` stays as typed.
    parseSearch,
    stringifySearch,
  });

  return router;
};
