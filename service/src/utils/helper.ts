import type { Request } from 'express'
import jwt from 'jsonwebtoken'
const JWT_SECRET = (process.env.JWT_SECRET || process.env.AUTH_SECRET_KEY || '').trim()

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
