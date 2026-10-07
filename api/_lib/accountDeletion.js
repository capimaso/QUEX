import { selectOne, supabaseRequest, supabaseRpc } from './db.js'
import { adminDeleteUser } from './supabaseAuth.js'
import { deleteAvatar } from './storage.js'
import { deletePhotoFiles, parsePhotoRefs } from './photos.js'

export async function deleteAccountData({
  targetUserId,
  actorUserId,
  adminMode = false,
}) {
  const target = await selectOne(
    'usuario',
    `id=eq.${encodeURIComponent(targetUserId)}`
  )

  if (!target) {
    const error = new Error('Usuário não encontrado.')
    error.status = 404
    throw error
  }

  const authUserId = target.auth_user_id || null
  const avatarPath = target.foto_perfil || null

  if (avatarPath) {
    await deleteAvatar(avatarPath).catch(error => {
      console.error('[QUÉX] Não foi possível remover o avatar durante a exclusão:', error)
    })
  }

  if (target.tipo === 'vendedor') {
    const products = await supabaseRequest(
      `/produto?select=id,fotos_url&vendedor_id=eq.${encodeURIComponent(targetUserId)}`
    ).catch(() => [])

    const photoRefs = (products || []).flatMap(product =>
      parsePhotoRefs(product.fotos_url)
    )

    await deletePhotoFiles(photoRefs).catch(error => {
      console.error(
        '[QUÉX] Não foi possível remover todas as fotos dos anúncios durante a exclusão:',
        error
      )
    })
  }

  const result = await supabaseRpc(
    'quex_excluir_conta_mod13',
    {
      p_usuario_id: Number(targetUserId),
      p_actor_id: Number(actorUserId),
      p_admin_mode: Boolean(adminMode),
    }
  )

  let authDeleted = false

  if (authUserId) {
    try {
      await adminDeleteUser(authUserId)
      authDeleted = true
    } catch (error) {
      console.error(
        '[QUÉX] Dados anonimizados, mas a identidade do Supabase Auth não pôde ser removida:',
        error
      )
    }
  }

  return {
    result: Array.isArray(result) ? result[0] : result,
    auth_deleted: authDeleted,
  }
}
