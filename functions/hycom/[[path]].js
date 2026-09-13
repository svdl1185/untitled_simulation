import { createProxy } from "../_lib/proxy.js";

export const onRequest = createProxy("https://ncss.hycom.org", { cacheTtl: 600 });
