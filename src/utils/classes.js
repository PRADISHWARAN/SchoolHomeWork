/* All classes in school order (Pre-KG → 10th). */
export const CLASSES = [
  "Pre-KG-A", "Pre-KG-B", "LKG-A", "LKG-B", "UKG-A", "UKG-B",
  "1st-A", "1st-B", "2nd-A", "2nd-B", "3rd-A", "3rd-B", "4th-A", "4th-B",
  "5th-A", "5th-B", "6th-A", "6th-B", "7th-A", "7th-B", "8th-A", "8th-B",
  "9th-A", "9th-B", "10th-A", "10th-B",
];

/** Sort class ids in school order (unknown ones last, alphabetically). */
export function sortClasses(list) {
  const rank = c => { const i = CLASSES.indexOf(c); return i === -1 ? 999 : i; };
  return [...list].sort((a, b) => rank(a) - rank(b) || String(a).localeCompare(String(b)));
}
