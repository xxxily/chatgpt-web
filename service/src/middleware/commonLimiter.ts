import type { Request, Response } from 'express'
import { RateLimiterMemory } from 'rate-limiter-flexible'
import { isNotEmptyString } from '../utils/is'
import JSON_DB from '../utils/db'

/* 这是针对所有接口的通用限流规则，所以值要尽量大些，但又不至于大到等于没限制的情况 */
const MAX_REQUEST_PER_MINUTE = '200'
const MAX_REQUEST_PER_HOUR = '2000'
const MAX_REQUEST_PER_DAY = '20000'

const MAX_BLACKLIST_TIME = process.env.MAX_BLACKLIST_TIME
const MAX_BLACKLIST_LIMITER_COUNT = process.env.MAX_BLACKLIST_LIMITER_COUNT
const FRYENDLY_TIPS = process.env.FRYENDLY_TIPS || ''

const LIMIT_MAP = {
  /* 一分钟内允许的最大请求数，默认不限制 */
  MAX_REQUEST_PER_MINUTE: (isNotEmptyString(MAX_REQUEST_PER_MINUTE) && !isNaN(Number(MAX_REQUEST_PER_MINUTE))) ? parseInt(MAX_REQUEST_PER_MINUTE) : 0,
  /* 一小时内允许的最大请求数，默认不限制 */
  MAX_REQUEST_PER_HOUR: (isNotEmptyString(MAX_REQUEST_PER_HOUR) && !isNaN(Number(MAX_REQUEST_PER_HOUR))) ? parseInt(MAX_REQUEST_PER_HOUR) : 0,
  /* 一天内允许的最大请求数，默认不限制 */
  MAX_REQUEST_PER_DAY: (isNotEmptyString(MAX_REQUEST_PER_DAY) && !isNaN(Number(MAX_REQUEST_PER_DAY))) ? parseInt(MAX_REQUEST_PER_DAY) : 0,
  /* 被拉入黑名单后多久能从黑名单里解锁出来，默认一天后解锁 */
  MAX_BLACKLIST_TIME: (isNotEmptyString(MAX_BLACKLIST_TIME) && !isNaN(Number(MAX_BLACKLIST_TIME))) ? parseInt(MAX_BLACKLIST_TIME) : 24 * 60 * 60 * 1000,
  /* 被拉入黑名单多少次后永久关入小黑屋，默认三次 */
  MAX_BLACKLIST_LIMITER_COUNT: (isNotEmptyString(MAX_BLACKLIST_LIMITER_COUNT) && !isNaN(Number(MAX_BLACKLIST_LIMITER_COUNT))) ? parseInt(MAX_BLACKLIST_LIMITER_COUNT) : 3,
  /* 被限流或被拉入黑名单后的友好提示，默认为空 */
  FRYENDLY_TIPS: FRYENDLY_TIPS || '',
}

const limitIpDbOpts = {
  dir: './',
  name: 'limitIp',
  useDayId: false,
}

/**
 * https://github.com/animir/node-rate-limiter-flexible/wiki/Memory
 * https://github.com/animir/node-rate-limiter-flexible/wiki/Options
 */
const rateLimiterIpByMinute = new RateLimiterMemory({
  points: LIMIT_MAP.MAX_REQUEST_PER_MINUTE,
  /* 一天 */
  duration: 1 * 60,
})

const rateLimiterIpByHour = new RateLimiterMemory({
  points: LIMIT_MAP.MAX_REQUEST_PER_HOUR,
  /* 一小时 */
  duration: 1 * 60 * 60,
})

const rateLimiterIpByDay = new RateLimiterMemory({
  points: LIMIT_MAP.MAX_REQUEST_PER_DAY,
  /* 一天 */
  duration: 1 * 60 * 60 * 24,
})

const friendlyTips = LIMIT_MAP.FRYENDLY_TIPS || ''

const commonLimiter = async (req: Request, res: Response, next) => {
  const realIp = (req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || req.ip) as string

  const db = await JSON_DB.get(limitIpDbOpts)
  const dbData = db.data = db.data ? db.data : { blacklist: {}, whitelist: {} }

  /* 如果ip处于白名单列表，则直接放行 */
  if (dbData.whitelist[realIp]) {
    next()
    return
  }

  /* 如果ip处于黑名单列表，则直接拒绝 */
  if (dbData.blacklist[realIp]) {
    const blackInfo = dbData.blacklist[realIp]
    const hasUnLock = Date.now() - blackInfo.canUseAt > 0

    if (!blackInfo.isInPrison && hasUnLock) {
      /* 对进过小黑屋但已解封的ip需保持警惕 */
      global.console.log(`[System Info] IP(${realIp}) has been released from the blacklist`)
    }
    else {
      if (blackInfo.isInPrison) {
        res.status(200).send({
          status: 'Fail',
          message: `\n[System Info]\n当前IP(${realIp})已被加入黑名单，可联系管理员解除限制 | This IP(${realIp}) has been added to the blacklist, please contact the administrator to remove the restriction${friendlyTips}`,
          data: null,
        })
      }
      else {
        res.status(200).send({
          status: 'Fail',
          message: `\n[System Info]\n当前IP(${realIp})已被加入受限名单，可于${new Date(blackInfo.canUseAt).toLocaleString()}后再次尝试 | This IP(${realIp}) has been added to the restricted list, please try again after ${new Date(blackInfo.canUseAt).toLocaleString()}${friendlyTips}`,
          data: null,
        })
      }

      return
    }
  }

  /* IP限位器(按天限流) */
  try {
    await rateLimiterIpByDay.consume(realIp)
  }
  catch (err) {
    /* 将ip加入黑名单，并锁定一段时间（一个ip里大量使用，要么说明是深度用户，理应付费使用，要么就是机器号，理应永久封禁） */
    dbData.blacklist[realIp] = dbData.blacklist[realIp] || {
      /* 进黑名单的创建时间 */
      createdAt: Date.now(),
      /* 解封时间 */
      canUseAt: Date.now() + LIMIT_MAP.MAX_BLACKLIST_TIME,
      /* 是否已经永久在小黑屋 */
      isInPrison: false,
      /* 进黑名单的次数统计 */
      limitCount: 0,
    }

    dbData.blacklist[realIp].limitCount += 1
    dbData.blacklist[realIp].isInPrison = dbData.blacklist[realIp].limitCount > LIMIT_MAP.MAX_BLACKLIST_LIMITER_COUNT
    if (!dbData.blacklist[realIp].isInPrison)
      dbData.blacklist[realIp].canUseAt = Date.now() + LIMIT_MAP.MAX_BLACKLIST_TIME

    await JSON_DB.save(limitIpDbOpts)

    res.status(200).send({
      status: 'Fail',
      message: `\n[System Info]\n当前IP(${realIp})一天内发起的请求太多 | Too many request from this IP(${realIp}) in 1 day ${friendlyTips}`,
      data: null,
    })

    return
  }

  try {
    await rateLimiterIpByHour.consume(realIp)
  }
  catch (err) {
    res.status(200).send({
      status: 'Fail',
      message: `\n[System Info]\n当前IP(${realIp})一小时内发起的请求太多 | Too many request from this IP(${realIp}) in 1 hour ${friendlyTips}`,
      data: null,
    })

    return
  }

  /* IP限位器(按分钟限流) */
  try {
    await rateLimiterIpByMinute.consume(realIp)
  }
  catch (err) {
    res.status(200).send({
      status: 'Fail',
      message: `\n[System Info]\n当前对话一分钟内发起的请求太多 | Too many request from this chat in 1 minute${friendlyTips}`,
      data: null,
    })

    return
  }

  next()
}

export { commonLimiter }
