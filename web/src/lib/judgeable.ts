/**
 * Is there enough here for a check to say anything? Used only to avoid a reassuring "No scam signs found" for
 * input like "asdkjh qwe 123 !!! ???". It never blocks a check: it only drives a calm hint before submitting and,
 * if a result still comes back as "no signs", the "Not enough to judge" state on the result page.
 *
 * Deliberately generous: anything that looks like a link, phone number or UPI ID, or any attachment, counts as
 * enough, and so do MIN_WORDS real words. A wrong "enough" costs nothing (the normal check runs); a wrong "not
 * enough" only shows a hint.
 */

/** Words of two or more letters/digits (any script, so Hindi counts). One-character scraps and punctuation do not. */
export const MIN_WORDS = 7;

const WORD = /[\p{L}\p{M}\p{N}]{2,}/gu;
// A scheme or www., or a bare domain on a TLD that scams commonly use (not any "word.word", which would match "Hello.Please").
const LINK = /(?:https?:\/\/|www\.)\S+|\b[a-z0-9-]+(?:\.[a-z0-9-]+)*\.(?:com|in|co|org|net|info|xyz|top|link|app|site|online|club|click|vip|me|io|ly|gl|cc|tk|ml|ga|cf|gq|biz|shop|live|icu|cyou|pw|ws)\b(?:\/\S*)?/i;
// 10 or more digits, optionally with +, spaces, dashes, dots or brackets between them.
const PHONE = /(?:\+?\d[\s().-]?){10,}/;
// name@handle, e.g. ravi@okbank (an email address matches too, which is fine).
const UPI = /\b[\w.-]{2,}@[a-z][a-z0-9]+\b/i;

/** True when the text holds a link, as a person would type or paste it. */
export function textHasLink(text: string): boolean {
  return LINK.test(text);
}

export function countWords(text: string): number {
  return text.match(WORD)?.length ?? 0;
}

/** The separate link box: anything with a scheme or a dotted host counts, a stray "asd" does not. */
function urlFieldIsLink(url: string): boolean {
  return /:\/\/|\S\.\S/.test(url.trim());
}

export function hasEnoughToJudge(input: { text?: string; url?: string; hasFile?: boolean }): boolean {
  if (input.hasFile) return true;
  if (input.url && urlFieldIsLink(input.url)) return true;
  const text = input.text?.trim() ?? "";
  if (!text) return false;
  return LINK.test(text) || PHONE.test(text) || UPI.test(text) || countWords(text) >= MIN_WORDS;
}
