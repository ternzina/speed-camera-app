import { utf8Bytes } from "./sha256";
// Observe the existing transport; checksum validation, timeouts and fallbacks stay in camera-delivery.
export function progressFetch(
  baseFetch,
  notify,
  country,
  expectedBytes,
  XHR = globalThis.XMLHttpRequest,
) {
  return (url, options = {}) => {
    const dataset =
      String(url).includes("/countries/") ||
      (String(url).includes("camera-export?country=") &&
        !String(url).endsWith("coverage"));
    if (!dataset || !XHR) return baseFetch(url, options);
    const expected = String(url).includes("/countries/") ? expectedBytes : null;
    return new Promise((resolve, reject) => {
      const request = new XHR(),
        start = Date.now();
      let settled = false;
      const report = (loaded, total, phase = "download") =>
        notify({
          country,
          loaded,
          total,
          phase,
          seconds: (Date.now() - start) / 1000,
        });
      const cleanup = () => options.signal?.removeEventListener("abort", abort);
      const fail = () => {
        if (settled) return;
        settled = true;
        cleanup();
        reject(new Error("Download unavailable"));
      };
      const abort = () => {
        request.abort();
        fail();
      };
      request.open("GET", url);
      request.setRequestHeader("Cache-Control", "no-cache");
      request.onprogress = (event) =>
        report(
          event.loaded,
          event.lengthComputable ? event.total : expected || null,
        );
      request.onload = () => {
        if (settled) return;
        settled = true;
        cleanup();
        const content = request.responseText || "";
        report(
          utf8Bytes(content).length,
          expected ||
            Number(request.getResponseHeader("Content-Length")) ||
            null,
          "verify",
        );
        resolve({
          ok: request.status >= 200 && request.status < 300,
          status: request.status,
          headers: { get: (name) => request.getResponseHeader(name) },
          text: async () => content,
        });
      };
      request.onerror = fail;
      request.ontimeout = fail;
      request.onabort = fail;
      options.signal?.addEventListener("abort", abort, { once: true });
      if (options.signal?.aborted) {
        abort();
        return;
      }
      report(0, expected || null);
      request.send();
    });
  };
}
