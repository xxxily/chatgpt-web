import type { Request, Response } from 'express'
import { isNotEmptyString } from '../utils/is'

const MAX_CHARACTER_SIZE = (isNotEmptyString(process.env.MAX_CHARACTER_SIZE) && !isNaN(Number(process.env.MAX_CHARACTER_SIZE))) ? parseInt(process.env.MAX_CHARACTER_SIZE) : 999999999
const FRYENDLY_TIPS = process.env.FRYENDLY_TIPS

const friendlyTips = FRYENDLY_TIPS || '\n\n[温馨提示]\n为了让更多人连接到AI的世界，建议提升问题质量并理性提问。 \n服务器小，请轻点使用~\n'

interface StrLenOpts {
  field?: string
  max?: number
  min?: number
  tips?: string
  statusCode?: number
}

/**
 * 限制输入字符串长度的中间件
 * @param opts
 * @returns
 */
const strlen = (opts: StrLenOpts = {}) => {
  const defaultOpts: StrLenOpts = {
    field: '',
    max: MAX_CHARACTER_SIZE,
    min: 0,
    tips: '',
    statusCode: 200,
  }

  opts = { ...defaultOpts, ...opts }

  return (req: Request, res: Response, next) => {
    const { field, max, min, tips, statusCode } = opts
    const value = req.body[field]

    if (isNotEmptyString(value)) {
      const len = value.length
      if (len > max) {
        return res.status(statusCode).json({
          status: 'Fail',
          message: tips || `输入的${field}长度超过了${max}个字符${friendlyTips}`,
          data: null,
        })
      }

      if (len < min) {
        return res.status(statusCode).json({
          status: 'Fail',
          message: tips || `输入的${field}长度小于了${min}个字符${friendlyTips}`,
          data: null,
        })
      }
    }

    next()
  }
}

export { strlen }
