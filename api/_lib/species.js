import { supabaseRequest } from './db.js'

// Espécies proibidas de vender (protegidas). Mantenha igual ao UPDATE do modulo4_produtos.sql.
// Compara sem acento, tratando hífen e espaço como iguais, e por palavra inteira.
const FORBIDDEN = ['garoupa', 'mero', 'cacao anjo', 'tubarao martelo', 'peixe serra', 'peixe boi', 'tartaruga marinha', 'cavalo marinho']

export const foldName = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[-_\s]+/g, ' ').trim()
export const isForbiddenSpecies = name => {
  const padded = ` ${foldName(name)} `
  return FORBIDDEN.some(item => padded.includes(` ${item} `))
}

export async function listActiveSpecies() {
  const rows = await supabaseRequest('/especie?select=id,nome&ativo=eq.true&order=nome.asc')
  return (rows || []).filter(row => !isForbiddenSpecies(row.nome)).map(row => ({ id: Number(row.id), name: row.nome }))
}

// Aceita species_id (preferido) ou species (texto, só se bater com uma espécie da lista).
export async function resolveSpecies(body) {
  const list = await listActiveSpecies()
  let found = null
  if (body.species_id !== undefined && body.species_id !== null && body.species_id !== '') {
    found = list.find(item => item.id === Number(body.species_id))
  } else if (String(body.species ?? '').trim()) {
    found = list.find(item => foldName(item.name) === foldName(body.species))
  }
  if (!found) return { error: 'Escolha uma espécie da lista.' }
  return { species: found }
}
