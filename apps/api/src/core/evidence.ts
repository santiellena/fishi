import type { AnalysisEmailInput } from "./types.js";

export interface EvidenceFragment { id: string; field: string; text: string }

/** Preserve every character exactly once, keeping each selectable quote bounded. */
export function evidenceFragments(email: AnalysisEmailInput): EvidenceFragment[] {
 const fields: [string, string][] = [["from", email.from], ["subject", email.subject], ["textBody", email.textBody], ...(email.links ?? []).map((link, index): [string, string] => [`links.${index}`, link])];
 const fragments: EvidenceFragment[] = [];
 for (const [field, text] of fields) {
  let offset = 0;
  while (offset < text.length) {
   let end = Math.min(offset + 600, text.length);
   if (end < text.length) {
    const window = text.slice(offset, end);
    const boundary = Math.max(window.lastIndexOf("\n"), window.lastIndexOf(". "), window.lastIndexOf("! "), window.lastIndexOf("? "));
    if (boundary >= 300) end = offset + boundary + 1;
    // Do not split a surrogate pair between JSON strings.
    const last = text.charCodeAt(end - 1);
    if (last >= 0xd800 && last <= 0xdbff) end--;
   }
   fragments.push({ id: `e${fragments.length + 1}`, field, text: text.slice(offset, end) });
   offset = end;
  }
 }
 return fragments;
}
