import { onSession } from "./auth.js";
import { initRouter, route } from "./router.js";

initRouter(document.getElementById("app"));

onSession((profile) => {
  route(profile);
});
