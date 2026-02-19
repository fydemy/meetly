import { t } from "@/lib/trpc/trpc";
import { eventRouter } from "./routes/event";
import { packageRouter } from "./routes/package";

export const appRouter = t.router({
  event: eventRouter,
  package: packageRouter,
});

export type AppRouter = typeof appRouter;
