import { describe, expect, it } from "vitest";
import type { TrpcContext } from "./_core/context";
import { appRouter } from "./routers";

describe("system.branding", () => {
  it("expõe o título público configurado para o aplicativo", async () => {
    process.env.VITE_APP_TITLE = "RendeBit — Bitcoin em reais";
    const caller = appRouter.createCaller({ user: null, req: {} as TrpcContext["req"], res: {} as TrpcContext["res"] });
    await expect(caller.system.branding()).resolves.toEqual({ title: "RendeBit — Bitcoin em reais" });
  });
});
