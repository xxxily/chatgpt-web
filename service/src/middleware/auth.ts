import { isNotEmptyString } from '../utils/is'
import { getJwtTokenPayload } from '../utils/helper'

const auth = async (req, res, next) => {
  const userInfo = getJwtTokenPayload(req)
  if (!userInfo) {
    res.send({ status: 'Unauthorized', message: '鉴权失败，请刷新重试或联系管理员 | Authentication failed, please refresh and try again or contact the administrator', data: null })
    return
  }

  const AUTH_SECRET_KEY = process.env.AUTH_SECRET_KEY
  if (isNotEmptyString(AUTH_SECRET_KEY)) {
    try {
      const Authorization = req.header('Authorization')
      if (!Authorization || Authorization.replace('Bearer ', '').trim() !== AUTH_SECRET_KEY.trim())
        throw new Error('Error: 无访问权限 | No access rights')
      next()
    }
    catch (error) {
      res.send({ status: 'Unauthorized', message: error.message ?? 'Please authenticate.', data: null })
    }
  }
  else {
    next()
  }
}

export { auth }
