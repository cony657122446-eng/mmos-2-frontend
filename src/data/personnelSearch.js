export function parsePersonnelSearch(value) {
  const keywords = String(value ?? '').split(/[\s,，、;；]+/u).filter(Boolean);
  const uniqueKeywords = new Map();
  for (const keyword of keywords) {
    const normalized = keyword.toLowerCase();
    if (!uniqueKeywords.has(normalized)) uniqueKeywords.set(normalized, keyword);
  }
  return [...uniqueKeywords.values()];
}

export function matchesPersonnelSearch(value, keywords) {
  const searchableText = String(value ?? '').toLowerCase();
  return keywords.length === 0 || keywords.some(keyword => searchableText.includes(keyword.toLowerCase()));
}

export function insertPersonnelSearchPaste(value, pastedText, selectionStart, selectionEnd) {
  const currentValue = String(value ?? '');
  const start = selectionStart ?? currentValue.length;
  const end = selectionEnd ?? start;
  const insertion = String(pastedText ?? '').replace(/[\r\n\t]+/g, '、');
  return {
    value: currentValue.slice(0, start) + insertion + currentValue.slice(end),
    caret: start + insertion.length,
  };
}
