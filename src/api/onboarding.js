import { apiRequest } from './client'

export async function verifyOnboardingDocument(document) {
  return apiRequest('/api/auth/register?resource=document', {
    method: 'POST',
    body: JSON.stringify({
      document,
    }),
  })
}

export async function getOnboardingFreightAverage() {
  return apiRequest('/api/auth/register?resource=freight_average')
}
