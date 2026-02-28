import { t } from "@/lib/trpc/trpc";
import { eventRouter } from "./routes/event";
import { packageRouter } from "./routes/package";
import { userRouter } from "./routes/user";
import { organizationRouter } from "./routes/organization";

export const appRouter = t.router({
  event: eventRouter,
  package: packageRouter,
  user: userRouter,
  organization: organizationRouter,
});

export type AppRouter = typeof appRouter;
