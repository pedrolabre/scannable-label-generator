export function splitOptionLabel(text) {
  const match = /^(.*?)\s*\(([^()]*)\)$/.exec(text);

  return match ? { label: match[1], detail: match[2] } : { label: text, detail: undefined };
}
