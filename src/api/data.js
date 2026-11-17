import { apiRequest } from './client'
import { supabase } from '@/lib/supabase'
import {
  compressAvatar,
  compressPhoto,
} from '@/lib/image'

export const fallbackImage =
  'https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=900&h=680&fit=crop'

function fromRenderProduct(product) {
  return {
    ...product,
    name: product.name || product.nome,
    description: product.description || product.descricao || '',
    species: product.species || product.especie || '',
    price: Number(product.price ?? product.preco),
    quantity: Number(product.quantity ?? product.estoque),
    active: product.active ?? product.ativo ?? true,
    seller_name:
      product.seller_name ||
      product.vendedor ||
      product.nome_loja ||
      '',
    image_url: product.image_url || fallbackImage,
    has_bones: Boolean(product.has_bones),
    water_type: product.water_type || 'doce',
    unit: product.unit || 'kg',
  }
}

function toRenderProduct(form, user) {
  return {
    vendedor_id: Number(user?.id),
    nome: form.name,
    descricao: form.description || '',
    especie: form.species || String(form.species_id || ''),
    preco: Number(form.price),
    estoque: Number(form.quantity),
    ativo: Boolean(form.active),
  }
}

export async function listProducts({
  activeOnly = true,
  search = '',
  sellerId,
  nearMe: _nearMe = false,
} = {}) {
  const data = await apiRequest('/api/produtos')
  const products = (Array.isArray(data) ? data : data.products || [])
    .map(fromRenderProduct)
    .filter(product => activeOnly ? product.active : true)
    .filter(product =>
      sellerId ? String(product.vendedor_id) === String(sellerId) : true
    )
    .filter(product => {
      const query = search.trim().toLocaleLowerCase('pt-BR')
      return query
        ? `${product.name} ${product.species} ${product.seller_name}`
            .toLocaleLowerCase('pt-BR')
            .includes(query)
        : true
    })

  return products
}

export async function getProduct(
  id,
  includeInactive = false
) {
  const product = await apiRequest(
    `/api/produtos/${encodeURIComponent(id)}`
  )

  if (!includeInactive && !product.ativo) return null
  return fromRenderProduct(product)
}

export async function saveProduct(
  form,
  user,
  id = 'new'
) {
  const payload = toRenderProduct(form, user)

  if (id === 'new') {
    const data = await apiRequest('/api/produtos', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
    return fromRenderProduct(data.product)
  }

  const data = await apiRequest(
    `/api/produtos/${encodeURIComponent(id)}`,
    {
      method: 'PUT',
      body: JSON.stringify(payload),
    }
  )
  return fromRenderProduct(data.product)
}

export async function listSpecies() {
  return (
    await apiRequest(
      '/api/products?resource=species'
    )
  ).species || []
}

export async function uploadProductPhotos(
  items,
  authUserId
) {
  if (
    items.some(item => item.file) &&
    !authUserId
  ) {
    throw new Error(
      'Sessão expirada. Entre de novo.'
    )
  }

  const uploaded = []
  const refs = []

  try {
    for (const item of items) {
      if (item.ref) {
        refs.push(item.ref)
        continue
      }

      const blob =
        await compressPhoto(
          item.file
        )

      const path =
        `${authUserId}/${Date.now()}-${Math.random()
          .toString(36)
          .slice(2, 8)}.jpg`

      const { error } =
        await supabase.storage
          .from('produtos')
          .upload(
            path,
            blob,
            {
              contentType:
                'image/jpeg',
              cacheControl:
                '31536000',
              upsert: false,
            }
          )

      if (error) {
        console.error(
          '[QUÉX] upload da foto do produto falhou:',
          error
        )

        if (
          /bucket not found/i.test(
            error.message || ''
          )
        ) {
          throw new Error(
            'O armazenamento de fotos de produto não foi configurado (falta rodar o modulo4_produtos.sql no Supabase).'
          )
        }

        throw new Error(
          'Não foi possível enviar uma das fotos. Tenta de novo.'
        )
      }

      uploaded.push(path)
      refs.push(path)
    }
  } catch (error) {
    await removeUploadedPhotos(
      uploaded
    )
    throw error
  }

  return {
    refs,
    uploaded,
  }
}

export async function removeUploadedPhotos(
  paths
) {
  if (!paths?.length) return

  await supabase.storage
    .from('produtos')
    .remove(paths)
    .catch(() => {})
}

export async function removeProduct(id) {
  return apiRequest(
    `/api/produtos/${encodeURIComponent(id)}`,
    { method: 'DELETE' }
  )
}

export async function toggleProduct(
  id,
  active
) {
  const product = await getProduct(id, true)
  const data = await apiRequest(
    `/api/produtos/${encodeURIComponent(id)}`,
    {
      method: 'PUT',
      body: JSON.stringify({
        vendedor_id: Number(product.vendedor_id),
        nome: product.name,
        descricao: product.description || '',
        especie: product.species,
        preco: Number(product.price),
        estoque: Number(product.quantity),
        ativo: Boolean(active),
      }),
    }
  )
  return fromRenderProduct(data.product)
}

export async function listCart() {
  return apiRequest('/api/cart')
}

export async function addToCart(
  _user,
  product,
  quantity
) {
  return apiRequest(
    '/api/cart',
    {
      method: 'POST',
      body: JSON.stringify({
        product_id:
          product.id,
        quantity,
      }),
    }
  )
}

export async function updateCartItem(
  id,
  quantity
) {
  return apiRequest(
    `/api/cart?id=${encodeURIComponent(id)}`,
    {
      method: 'PATCH',
      body: JSON.stringify({
        quantity,
      }),
    }
  )
}

export async function removeCartItem(
  id
) {
  return apiRequest(
    `/api/cart?id=${encodeURIComponent(id)}`,
    {
      method: 'DELETE',
    }
  )
}

export async function checkout(
  _items,
  _buyer,
  address,
  paymentMethod = 'pix'
) {
  const data =
    await apiRequest(
      '/api/orders?resource=checkout',
      {
        method: 'POST',
        body: JSON.stringify({
          address,
          payment_method:
            paymentMethod,
        }),
      }
    )

  return data.order
}

export async function listBuyerOrders() {
  return (
    await apiRequest(
      '/api/orders'
    )
  ).orders || []
}

export async function listSellerOrders() {
  return (
    await apiRequest(
      '/api/orders'
    )
  ).orders || []
}

export async function submitReview({
  orderId,
  rating,
  comment,
}) {
  const data =
    await apiRequest(
      '/api/orders?resource=review',
      {
        method: 'POST',
        body: JSON.stringify({
          order_id: orderId,
          rating,
          comment,
        }),
      }
    )

  return data.review
}

export async function updateOrderStatus(
  orderId,
  status
) {
  return (
    await apiRequest(
      `/api/orders?id=${encodeURIComponent(orderId)}`,
      {
        method: 'PATCH',
        body: JSON.stringify({
          status,
        }),
      }
    )
  ).order
}

export async function cartCount() {
  const data =
    await apiRequest(
      '/api/cart'
    )

  return data.items?.length || 0
}

export async function updateProfile(
  payload
) {
  return (
    await apiRequest(
      '/api/profile',
      {
        method: 'PUT',
        body:
          JSON.stringify(
            payload
          ),
      }
    )
  ).user
}

export async function changePassword(
  currentPassword,
  newPassword
) {
  const { data } =
    await supabase.auth.getUser()

  const email =
    data.user?.email

  if (!email) {
    throw new Error(
      'Sessão expirada. Entre de novo.'
    )
  }

  if (
    currentPassword !== null
  ) {
    const check =
      await supabase.auth.signInWithPassword(
        {
          email,
          password:
            currentPassword,
        }
      )

    if (check.error) {
      throw new Error(
        'A senha atual está incorreta.'
      )
    }
  }

  const { error } =
    await supabase.auth.updateUser(
      {
        password: newPassword,
      }
    )

  if (error) {
    throw new Error(
      error.message ||
        'Não foi possível alterar a senha.'
    )
  }

  return { ok: true }
}

export async function listSellers({
  search = '',
  location = '',
  limit = 24,
  offset = 0,
  nearMe = false,
} = {}) {
  const params =
    new URLSearchParams({
      limit: String(limit),
      offset: String(offset),
    })

  if (search.trim()) {
    params.set(
      'search',
      search.trim()
    )
  }

  if (location.trim()) {
    params.set(
      'location',
      location.trim()
    )
  }

  if (nearMe) {
    params.set(
      'near_me',
      'true'
    )
  }

  return (
    await apiRequest(
      `/api/people?${params}`
    )
  ).people || []
}

export async function getPerson(id) {
  return (
    await apiRequest(
      `/api/people?id=${encodeURIComponent(id)}`
    )
  ).person
}

export async function submitReport({
  reporterId,
  reportedUserId,
  productId = null,
  category,
  description = '',
}) {
  return apiRequest(
    '/api/report',
    {
      method: 'POST',
      body: JSON.stringify({
        denunciante_id:
          Number(reporterId),
        usuario_denunciado_id:
          Number(reportedUserId),
        produto_id:
          productId == null
            ? null
            : Number(
                productId
              ),
        categoria: category,
        descricao:
          description.trim() ||
          null,
      }),
    }
  )
}

export async function createSupportTicket({
  reason,
  message,
}) {
  return apiRequest(
    '/api/support',
    {
      method: 'POST',
      body: JSON.stringify({
        motivo: reason,
        mensagem: message,
      }),
    }
  )
}

export async function submitCpfClaim({
  cpf,
  email,
  phone,
  reason,
}) {
  return apiRequest(
    '/api/support?resource=claim-cpf',
    {
      method: 'POST',
      body: JSON.stringify({
        cpf,
        email,
        telefone: phone,
        motivo: reason,
      }),
    }
  )
}

export async function listMySupportTickets() {
  return (
    await apiRequest(
      '/api/support'
    )
  ).tickets || []
}

export async function getMySupportTicket(
  ticketId
) {
  return apiRequest(
    `/api/support?resource=ticket&id=${encodeURIComponent(ticketId)}`
  )
}

export async function sendSupportMessage(
  ticketId,
  message
) {
  return apiRequest(
    '/api/support?resource=message',
    {
      method: 'POST',
      body: JSON.stringify({
        ticket_id:
          Number(ticketId),
        mensagem:
          message.trim(),
      }),
    }
  )
}

export async function uploadAvatar(
  file,
  authUserId
) {
  const blob =
    await compressAvatar(file)

  const path =
    `${authUserId}/${Date.now()}.jpg`

  const { error } =
    await supabase.storage
      .from('avatars')
      .upload(path, blob, {
        contentType:
          'image/jpeg',
        cacheControl:
          '31536000',
        upsert: false,
      })

  if (error) {
    console.error(
      '[QUÉX] upload da foto falhou:',
      error
    )

    if (
      /bucket not found/i.test(
        error.message || ''
      )
    ) {
      throw new Error(
        'O armazenamento de fotos ainda não foi configurado (falta rodar o modulo3_perfis.sql no Supabase).'
      )
    }

    throw new Error(
      'Não foi possível enviar a foto. Tenta de novo.'
    )
  }

  return (
    await apiRequest(
      '/api/profile',
      {
        method: 'PATCH',
        body: JSON.stringify({
          photo_path: path,
        }),
      }
    )
  ).user
}

export async function removeAvatar() {
  return (
    await apiRequest(
      '/api/profile',
      {
        method: 'PATCH',
        body: JSON.stringify({
          photo_path: null,
        }),
      }
    )
  ).user
}
