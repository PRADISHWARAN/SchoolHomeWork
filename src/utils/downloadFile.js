/**
 * downloadFile
 *
 * Forces a file to download instead of opening in a new tab.
 *
 * Strategy:
 *  1. For Firebase Storage URLs — append ?response-content-disposition=attachment
 *     so Firebase itself sends back Content-Disposition: attachment.
 *     The browser then saves the file automatically — no CORS fetch needed.
 *  2. For any other URL — try fetch → blob → click the blob URL.
 *  3. Last resort fallback — open in new tab.
 *
 * @param {string} url       Firebase Storage download URL (or any URL)
 * @param {string} fileName  Desired save filename
 */
export function downloadFile(url, fileName) {
  if (!url) return;

  /* ── Firebase Storage: add server-side Content-Disposition header ── */
  if (url.includes("firebasestorage.googleapis.com")) {
    const name        = fileName || "download";
    const disposition = encodeURIComponent(`attachment; filename="${name}"`);
    const sep         = url.includes("?") ? "&" : "?";
    const dlUrl       = `${url}${sep}response-content-disposition=${disposition}`;

    const a = document.createElement("a");
    a.href     = dlUrl;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    return;
  }

  /* ── Other URLs: fetch → blob ── */
  fetch(url)
    .then((res) => {
      if (!res.ok) throw new Error("fetch failed");
      return res.blob();
    })
    .then((blob) => {
      const blobUrl = URL.createObjectURL(blob);
      const a       = document.createElement("a");
      a.href        = blobUrl;
      a.download    = fileName || "download";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 10_000);
    })
    .catch(() => {
      /* Last resort — at least open it */
      window.open(url, "_blank", "noreferrer");
    });
}
