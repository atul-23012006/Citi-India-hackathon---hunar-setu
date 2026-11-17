import { render } from "preact";
import { registerSW } from "virtual:pwa-register";
import { App } from "./App.tsx";
import { loadState } from "./store.ts";
import { mergePartnerOpportunities, startSync } from "./sync.ts";
import "./styles.css";

registerSW({ immediate: true });

loadState().then(() => {
  mergePartnerOpportunities();
  startSync();
});

render(<App />, document.getElementById("app")!);
