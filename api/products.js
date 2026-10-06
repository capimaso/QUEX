import {
  deleteWhere,
  insertOne,
  selectOne,
  supabaseRequest,
  updateOne,
} from './_lib/db.js'
import { requireUser } from './_lib/auth.js'
import {
  badRequest,
  forbidden,
  notFound,
  ok,
  readBody,
  serverError,
} from './_lib/http.js'
import {
  listActiveSpecies,
  resolveSpecies,
} from './_lib/species.js'
import {
  deletePhotoFiles,
  parsePhotoRefs,
  photoUrl,
  serializePhotoRefs,
  validatePhotoRefs,
} from './_lib/photos.js'
import {
  normalizeSearchTerm,
  normalizeText,
} from './_lib/text.js'

const fallbackImage =
  'https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=900&h=680&fit=crop'

const cleanText = value =>
  String(value ?? '').trim()

function normalizeUnit(value) {
  const normalized =
    normalizeText(value)

  if (
    normalized === 'unit' ||
    normalized === 'unidade'
  ) {
    return 'unidade'
  }

  if (
    normalized === 'dozen' ||
    normalized === 'duzia'
  ) {
    return 'duzia'
  }

  return 'kg'
}

function mapProduct(
  row,
  seller = null,
  sellerUser = null
) {
  const photoRefs =
    parsePhotoRefs(row.fotos_url)

  const photos = photoRefs.map(
    ref => ({
      ref,
      url: photoUrl(ref),
    })
  )

  const images =
    photoRefs.map(photoUrl)

  return {
    id: Number(row.id),
    seller_id: Number(
      row.vendedor_id
    ),
    seller_name:
      seller?.comercial ||
      sellerUser?.nome ||
      'Pescador local',
    seller_email:
      sellerUser?.email || '',
    name: row.nome || '',
    species: row.especie || '',
    description:
      row.descricao || '',
    price: Number(
      row.preco || 0
    ),
    quantity: Number(
      row.quantidade || 0
    ),
    unit: normalizeUnit(
      row.unidade
    ),
    active: Boolean(row.ativo),
    species_id:
      row.especie_id == null
        ? null
        : Number(row.especie_id),
    photos,
    images,
    image_url:
      images[0] || fallbackImage,
    has_bones: Boolean(
      row.tem_espinha
    ),
    water_type:
      row.tipo_agua || 'doce',
  }
}

async function decorateProducts(rows) {
  if (!rows?.length) return []

  const ids = [
    ...new Set(
      rows
        .map(row =>
          Number(row.vendedor_id)
        )
        .filter(Boolean)
    ),
  ]

  const idFilter =
    `id=in.(${ids.join(',')})`

  const sellers = ids.length
    ? await supabaseRequest(
        `/vendedor?select=id,comercial,entrega_propria,localizacao&${idFilter}`
      )
    : []

  const users = ids.length
    ? await supabaseRequest(
        `/usuario?select=id,nome,email&${idFilter}`
      )
    : []

  const sellerMap = new Map(
    (sellers || []).map(seller => [
      Number(seller.id),
      seller,
    ])
  )

  const userMap = new Map(
    (users || []).map(user => [
      Number(user.id),
      user,
    ])
  )

  return rows.map(row =>
    mapProduct(
      row,
      sellerMap.get(
        Number(row.vendedor_id)
      ),
      userMap.get(
        Number(row.vendedor_id)
      )
    )
  )
}

async function sellerExists(userId) {
  return Boolean(
    await selectOne(
      'vendedor',
      `id=eq.${encodeURIComponent(userId)}`
    )
  )
}

async function getOwnedProduct(
  userId,
  id
) {
  return selectOne(
    'produto',
    `id=eq.${encodeURIComponent(id)}&vendedor_id=eq.${encodeURIComponent(userId)}`
  )
}

function productMatchesSearch(
  product,
  search
) {
  if (!search) return true

  return [
    product.name,
    product.species,
    product.description,
    product.seller_name,
  ].some(value =>
    normalizeText(value).includes(
      search
    )
  )
}

export default async function handler(
  req,
  res
) {
  try {
    if (
      req.method === 'GET' &&
      req.query?.resource ===
        'species'
    ) {
      return ok(res, {
        species:
          await listActiveSpecies(),
      })
    }

    if (req.method === 'GET') {
      const id = req.query?.id

      let activeOnly =
        req.query?.active !==
        'false'

      const sellerId =
        req.query?.seller_id

      const search =
        normalizeSearchTerm(
          req.query?.search,
          100
        )

      let viewer = null

      if (!activeOnly) {
        try {
          viewer =
            await requireUser(req)
        } catch {
          viewer = null
        }

        if (
          viewer?.tipo !==
          'vendedor'
        ) {
          activeOnly = true
        }

        if (
          sellerId &&
          Number(sellerId) !==
            Number(viewer?.id)
        ) {
          return forbidden(
            res,
            'Não é permitido consultar o catálogo privado de outro vendedor.'
          )
        }
      }

      const conditions = []

      if (id) {
        conditions.push(
          `id=eq.${encodeURIComponent(id)}`
        )
      }

      if (activeOnly) {
        conditions.push(
          'ativo=eq.true'
        )
      }

      if (sellerId) {
        conditions.push(
          `vendedor_id=eq.${encodeURIComponent(sellerId)}`
        )
      }

      let rows = []
      let usedSearchView = false

      if (search) {
        const searchConditions = [
          ...conditions,
          `busca_normalizada=ilike.${encodeURIComponent(`*${search}*`)}`,
        ]

        const query =
          searchConditions.length
            ? `&${searchConditions.join('&')}`
            : ''

        try {
          rows =
            await supabaseRequest(
              `/produto_busca?select=*&order=id.desc${query}`
            )

          usedSearchView = true
        } catch (error) {
          console.warn(
            '[QUÉX] produto_busca indisponível; usando fallback normalizado em memória.',
            error?.message || error
          )

          const fallbackQuery =
            conditions.length
              ? `&${conditions.join('&')}`
              : ''

          rows =
            await supabaseRequest(
              `/produto?select=*&order=id.desc${fallbackQuery}`
            )
        }
      } else {
        const query =
          conditions.length
            ? `&${conditions.join('&')}`
            : ''

        rows =
          await supabaseRequest(
            `/produto?select=*&order=id.desc${query}`
          )
      }

      let products =
        await decorateProducts(
          rows || []
        )

      if (
        search &&
        !usedSearchView
      ) {
        products =
          products.filter(product =>
            productMatchesSearch(
              product,
              search
            )
          )
      }

      if (id) {
        const product =
          products[0]

        if (!product) {
          return notFound(
            res,
            'Produto não encontrado.'
          )
        }

        return ok(res, {
          product,
        })
      }

      return ok(res, {
        products,
      })
    }

    const user =
      await requireUser(req)

    if (!user) {
      return res
        .status(401)
        .json({
          error:
            'Faça login para continuar.',
        })
    }

    if (req.method === 'POST') {
      if (
        user.tipo !==
        'vendedor'
      ) {
        return forbidden(
          res,
          'Somente vendedores podem cadastrar produtos.'
        )
      }

      if (
        !await sellerExists(
          user.id
        )
      ) {
        return forbidden(
          res,
          'Perfil de vendedor não encontrado.'
        )
      }

      const body =
        readBody(req)

      const name =
        cleanText(body.name)

      const price =
        Number(body.price)

      const quantity =
        Number(body.quantity)

      const waterType =
        cleanText(
          body.water_type
        )

      if (!name) {
        return badRequest(
          res,
          'Informe o nome do produto.'
        )
      }

      const resolved =
        await resolveSpecies(body)

      if (resolved.error) {
        return badRequest(
          res,
          resolved.error
        )
      }

      let photoRefs = []

      if (
        body.photos !==
        undefined
      ) {
        const checked =
          await validatePhotoRefs(
            body.photos,
            user.auth_user_id,
            []
          )

        if (checked.error) {
          return badRequest(
            res,
            checked.error
          )
        }

        photoRefs =
          checked.refs
      }

      if (
        !Number.isFinite(price) ||
        price <= 0
      ) {
        return badRequest(
          res,
          'O preço deve ser maior que zero.'
        )
      }

      if (
        !Number.isInteger(
          quantity
        ) ||
        quantity < 0
      ) {
        return badRequest(
          res,
          'A quantidade deve ser um número inteiro não negativo.'
        )
      }

      if (
        ![
          'doce',
          'salgada',
        ].includes(waterType)
      ) {
        return badRequest(
          res,
          'Selecione água doce ou água salgada.'
        )
      }

      if (
        String(body.name).length >
        150
      ) {
        return badRequest(
          res,
          'O nome do produto é muito longo.'
        )
      }

      const row =
        await insertOne(
          'produto',
          {
            vendedor_id:
              Number(user.id),
            nome: name,
            preco: price,
            descricao:
              cleanText(
                body.description
              ) || null,
            quantidade:
              quantity,
            fotos_url:
              serializePhotoRefs(
                photoRefs
              ),
            especie_id:
              resolved.species.id,
            especie:
              resolved.species.name,
            ativo:
              body.active !==
              false,
            tem_espinha:
              Boolean(
                body.has_bones
              ),
            tipo_agua:
              waterType,
            unidade:
              normalizeUnit(
                body.unit
              ),
          }
        )

      const [product] =
        await decorateProducts(
          [row]
        )

      return res
        .status(201)
        .json({
          product,
        })
    }

    if (req.method === 'PATCH') {
      if (
        user.tipo !==
        'vendedor'
      ) {
        return forbidden(
          res,
          'Somente vendedores podem editar produtos.'
        )
      }

      const id =
        req.query?.id

      if (!id) {
        return badRequest(
          res,
          'ID do produto é obrigatório.'
        )
      }

      const owned =
        await getOwnedProduct(
          user.id,
          id
        )

      if (!owned) {
        return notFound(
          res,
          'Produto não encontrado ou não pertence à sua loja.'
        )
      }

      const body =
        readBody(req)

      const payload = {}

      if (
        body.name !==
        undefined
      ) {
        payload.nome =
          cleanText(body.name)
      }

      if (
        body.species_id !==
          undefined ||
        body.species !==
          undefined
      ) {
        const resolved =
          await resolveSpecies(body)

        if (resolved.error) {
          return badRequest(
            res,
            resolved.error
          )
        }

        payload.especie_id =
          resolved.species.id
        payload.especie =
          resolved.species.name
      }

      let removedRefs = []

      if (
        body.photos !==
        undefined
      ) {
        const current =
          parsePhotoRefs(
            owned.fotos_url
          )

        const checked =
          await validatePhotoRefs(
            body.photos,
            user.auth_user_id,
            current
          )

        if (checked.error) {
          return badRequest(
            res,
            checked.error
          )
        }

        payload.fotos_url =
          serializePhotoRefs(
            checked.refs
          )

        removedRefs =
          current.filter(
            ref =>
              !checked.refs.includes(
                ref
              )
          )
      }

      if (
        body.description !==
        undefined
      ) {
        payload.descricao =
          cleanText(
            body.description
          ) || null
      }

      if (
        body.price !==
        undefined
      ) {
        payload.preco =
          Number(body.price)
      }

      if (
        body.quantity !==
        undefined
      ) {
        payload.quantidade =
          Number(body.quantity)
      }

      if (
        body.active !==
        undefined
      ) {
        payload.ativo =
          Boolean(body.active)
      }

      if (
        body.has_bones !==
        undefined
      ) {
        payload.tem_espinha =
          Boolean(
            body.has_bones
          )
      }

      if (
        body.water_type !==
        undefined
      ) {
        payload.tipo_agua =
          cleanText(
            body.water_type
          )
      }

      if (
        body.unit !==
        undefined
      ) {
        payload.unidade =
          normalizeUnit(
            body.unit
          )
      }

      if (
        payload.preco !==
          undefined &&
        (
          !Number.isFinite(
            payload.preco
          ) ||
          payload.preco <= 0
        )
      ) {
        return badRequest(
          res,
          'O preço deve ser maior que zero.'
        )
      }

      if (
        payload.quantidade !==
          undefined &&
        (
          !Number.isInteger(
            payload.quantidade
          ) ||
          payload.quantidade < 0
        )
      ) {
        return badRequest(
          res,
          'A quantidade deve ser um inteiro não negativo.'
        )
      }

      if (
        payload.tipo_agua !==
          undefined &&
        ![
          'doce',
          'salgada',
        ].includes(
          payload.tipo_agua
        )
      ) {
        return badRequest(
          res,
          'Tipo de água inválido.'
        )
      }

      if (
        payload.nome === ''
      ) {
        return badRequest(
          res,
          'Informe o nome do produto.'
        )
      }

      const row =
        await updateOne(
          'produto',
          `id=eq.${encodeURIComponent(id)}&vendedor_id=eq.${encodeURIComponent(user.id)}`,
          payload
        )

      await deletePhotoFiles(
        removedRefs
      )

      const [product] =
        await decorateProducts(
          [row]
        )

      return ok(res, {
        product,
      })
    }

    if (req.method === 'DELETE') {
      if (
        user.tipo !==
        'vendedor'
      ) {
        return forbidden(
          res,
          'Somente vendedores podem excluir produtos.'
        )
      }

      const id =
        req.query?.id

      if (!id) {
        return badRequest(
          res,
          'ID do produto é obrigatório.'
        )
      }

      const owned =
        await getOwnedProduct(
          user.id,
          id
        )

      if (!owned) {
        return notFound(
          res,
          'Produto não encontrado ou não pertence à sua loja.'
        )
      }

      try {
        await deleteWhere(
          'produto',
          `id=eq.${encodeURIComponent(id)}&vendedor_id=eq.${encodeURIComponent(user.id)}`
        )
      } catch (error) {
        if (
          String(
            error.message || ''
          )
            .toLowerCase()
            .includes(
              'pedido_item'
            ) ||
          error.status === 409
        ) {
          return res
            .status(409)
            .json({
              error:
                'Este produto já participa de um pedido e não pode ser excluído. Desative o anúncio.',
            })
        }

        throw error
      }

      await deletePhotoFiles(
        parsePhotoRefs(
          owned.fotos_url
        )
      )

      return ok(res, {
        ok: true,
      })
    }

    return res
      .status(405)
      .json({
        error:
          'Método não permitido.',
      })
  } catch (error) {
    return serverError(
      res,
      error
    )
  }
}
