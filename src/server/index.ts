import { tenantRouter } from "./routers/tenant";
import { router } from "./trpc";

export const appRouter = router({
  tenant: tenantRouter,
});

export type AppRouter = typeof appRouter;
