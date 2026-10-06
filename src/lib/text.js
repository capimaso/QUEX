export function normalizeSearchDisplay(value) {
  return String(value ?? '').normalize('NFD')
}

export function normalizeText(value) {
  return normalizeSearchDisplay(value)
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}
