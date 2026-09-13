import { createProxy } from "../_lib/proxy.js";

export const onRequest = createProxy("https://www.gmrt.org", { cacheTtl: 86400 });
