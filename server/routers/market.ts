import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { getBtcBrlQuote } from "../services/btcBrlQuote";
import { BTC_HISTORY_PERIODS, getBtcBrlHistory } from "../services/btcBrlHistory";

export const marketRouter = router({
  btcBrl: publicProcedure.query(() => getBtcBrlQuote()),
  history: publicProcedure
    .input(z.object({ period: z.enum(BTC_HISTORY_PERIODS) }))
    .query(({ input }) => getBtcBrlHistory(input.period)),
});
