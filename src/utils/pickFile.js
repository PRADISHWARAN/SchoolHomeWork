import toast from "react-hot-toast";

/**
 * File-input onChange helper that rejects files over `maxMB`.
 * The same limits are enforced server-side in storage.rules.
 *
 *   <input type="file" onChange={e => pickFile(e, 10, f => setFile(f))} />
 */
export function pickFile(e, maxMB, onPick) {
  const file = e.target.files?.[0];
  if (!file) return;
  if (file.size > maxMB * 1024 * 1024) {
    toast.error(`File is too big — please choose one under ${maxMB} MB 📦`);
    e.target.value = ""; // let the user pick again
    return;
  }
  onPick(file);
}
