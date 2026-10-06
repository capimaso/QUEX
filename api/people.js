import {
  selectOne,
  supabaseRequest,
} from './_lib/db.js'
import {
  requireUser,
} from './_lib/auth.js'
import {
  badRequest,
  notFound,
  ok,
  serverError,
  unauthorized,
} from './_lib/http.js'
import {
  avatarUrl,
} from './_lib/storage.js'
import {
  normalizeSearchTerm,
} from './_lib/text.js'
import {
  buildSellerRelevance,
  sortByRelevance,
} from './_lib/relevance.js'

function mapPerson(
  row,
  relevance = null
) {
  return {
    id: Number(row.id),
    role:
      row.tipo === 'vendedor'
        ? 'seller'
        : 'buyer',
    name:
      row.nome_exibicao ||
      row.nome ||
      '',
    responsible:
      row.comercial &&
      row.nome &&
      row.comercial !== row.nome
        ? row.nome
        : '',
    bio: row.bio || '',
    localizacao:
      row.cidade && row.uf
        ? `${row.cidade} - ${row.uf}`
        : '',
    cidade:
      row.cidade || '',
    uf: row.uf || '',
    foto_url: avatarUrl(
      row.foto_perfil
    ),
    rating: {
      average:
        row.media == null
          ? null
          : Number(row.media),
      count: Number(
        row.total || 0
      ),
    },
    relevance_score:
      Number(
        relevance?.score || 0
      ),
    proximity_factor:
      Number(
        relevance?.proximity ||
          1
      ),
    completed_sales:
      Number(
        relevance
          ?.completedSales || 0
      ),
  }
}

export default async function handler(
  req,
  res
) {
  if (req.method !== 'GET') {
    return res
      .status(405)
      .json({
        error:
          'Método não permitido.',
      })
  }

  try {
    const viewer =
      await requireUser(req)

    if (!viewer) {
      return unauthorized(res)
    }

    if (
      req.query?.id !==
      undefined
    ) {
      const id =
        Number(req.query.id)

      if (
        !Number.isInteger(id) ||
        id <= 0
      ) {
        return badRequest(
          res,
          'Perfil inválido.'
        )
      }

      const row =
        await selectOne(
          'perfil_publico',
          `id=eq.${id}`
        )

      if (!row) {
        return notFound(
          res,
          'Perfil não encontrado.'
        )
      }

      const resumo =
        await selectOne(
          'avaliacao_resumo',
          `usuario_id=eq.${id}`
        )

      const person =
        mapPerson(row)

      person.rating.distribution =
        {
          1: Number(
            resumo?.nota_1 || 0
          ),
          2: Number(
            resumo?.nota_2 || 0
          ),
          3: Number(
            resumo?.nota_3 || 0
          ),
          4: Number(
            resumo?.nota_4 || 0
          ),
          5: Number(
            resumo?.nota_5 || 0
          ),
        }

      return ok(res, {
        person,
      })
    }

    const search =
      normalizeSearchTerm(
        req.query?.search,
        60
      )

    const location =
      normalizeSearchTerm(
        req.query?.location,
        60
      )

    const nearMe =
      req.query?.near_me ===
      'true'

    const limit =
      Math.min(
        Math.max(
          parseInt(
            req.query?.limit,
            10
          ) || 24,
          1
        ),
        60
      )

    const offset =
      Math.max(
        parseInt(
          req.query?.offset,
          10
        ) || 0,
        0
      )

    const conditions = [
      'tipo=eq.vendedor',
    ]

    if (search) {
      conditions.push(
        `nome_busca=ilike.${encodeURIComponent(`*${search}*`)}`
      )
    }

    if (location) {
      conditions.push(
        `local_busca=ilike.${encodeURIComponent(`*${location}*`)}`
      )
    }

    const rows =
      await supabaseRequest(
        `/perfil_publico?select=*&${conditions.join('&')}`
      )

    const sellerIds =
      (rows || []).map(
        row => Number(row.id)
      )

    const relevance =
      await buildSellerRelevance(
        sellerIds,
        viewer,
        nearMe
      )

    let sorted =
      sortByRelevance(
        rows || [],
        relevance,
        row => row.id,
        nearMe
      )

    sorted =
      sorted.slice(
        offset,
        offset + limit
      )

    return ok(res, {
      people:
        sorted.map(row =>
          mapPerson(
            row,
            relevance.get(
              Number(row.id)
            )
          )
        ),
      limit,
      offset,
      total:
        (rows || []).length,
    })
  } catch (error) {
    return serverError(
      res,
      error
    )
  }
}
