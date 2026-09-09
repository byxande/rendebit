import { publicProcedure, router } from "../_core/trpc";
import { getBtcBrlQuote } from "../services/btcBrlQuote";

export const marketRouter = router({
  btcBrl: publicProcedure.query(() => getBtcBrlQuote()),
});
