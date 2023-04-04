import type { Request } from 'express'
import jwt from 'jsonwebtoken'
const JWT_SECRET = (process.env.JWT_SECRET || process.env.AUTH_SECRET_KEY || '').trim()
const VIP_JWT_SECRET = (process.env.VIP_JWT_SECRET || process.env.VIP_JWT_SECRET || '').trim()
const ADMIN_JWT_SECRET = (process.env.ADMIN_JWT_SECRET || process.env.ADMIN_JWT_SECRET || '').trim()

export function getJwtToken(req: Request): string {
  // const token = req.headers.authorization?.split(' ')[1]
  const token = req.cookies['ACCESS-TOKEN'] || req.cookies['TEMP-ACCESS-TOKEN']
  return (token || '').trim()
}

export function verifyJwtToken(token: string): any {
  return jwt.verify(token, JWT_SECRET)
}

export function getJwtTokenPayload(req: Request): any {
  const token = getJwtToken(req)
  try {
    return verifyJwtToken(token)
  }
  catch (error) {
    return null
  }
}

export function createTempJwtToken(): string {
  const token = jwt.sign(
    {
      userId: '-1',
      name: 'tempUser',
      timestamp: Date.now(),
    },
    JWT_SECRET,
    { expiresIn: '60d' },
  )

  return token
}

interface VipKeyJwtTokenPayload {
  userId?: string
  name?: string
  timestamp?: number
  expiresIn?: string
  count?: number
  level?: number
}

export function createVipKeyToken(payload: VipKeyJwtTokenPayload): string {
  const token = jwt.sign(
    {
      userId: payload.userId || '-100',
      name: payload.name || 'vipUser',
      timestamp: payload.timestamp || Date.now(),
      /* 可用点数 */
      count: payload.count || 1,
      level: payload.level || 0,
    },
    VIP_JWT_SECRET,
    { expiresIn: payload.expiresIn || '3d' },
  )

  return token
}

export function getVipKeyInfo(token: string): VipKeyJwtTokenPayload | null {
  try {
    const vipKeyInfo = jwt.verify(token, VIP_JWT_SECRET)
    return vipKeyInfo as VipKeyJwtTokenPayload
  }
  catch (error) {
    return null
  }
}

export function createAdminToken(jwtSecret: string, expiresIn = '30d'): string {
  if (!jwtSecret || jwtSecret.length < 32 || jwtSecret !== ADMIN_JWT_SECRET)
    return ''

  const token = jwt.sign(
    {
      userId: '1',
      name: 'superAdmin',
      timestamp: Date.now(),
      /* 可用点数 */
      count: 99999999,
      level: 99999999,
    },
    ADMIN_JWT_SECRET,
    { expiresIn },
  )

  return token
}

export function verifyAdminToken(token: string): any {
  return jwt.verify(token, ADMIN_JWT_SECRET)
}
