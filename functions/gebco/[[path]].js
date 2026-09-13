import { createProxy } from "../_lib/proxy.js";

export const onRequest = createProxy("https://wms.gebco.net", { cacheTtl: 86400 });
