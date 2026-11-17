import { app } from "./app.ts";
import { getIssuer } from "./issuer.ts";
import { probeAi } from "./claude.ts";

const port = Number(process.env.PORT ?? 8787);
app.listen(port, "0.0.0.0", async () => {
  const i = await getIssuer();
  const ai = await probeAi();
  console.log(`Hunar Setu hub on :${port}  ai=${ai ? "on" : "off (guided mode)"}  issuer=${i.did.slice(0, 32)}...`);
});
