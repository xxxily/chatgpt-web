import type { Request, Response } from 'express'
import { RateLimiterMemory } from 'rate-limiter-flexible'
import { isNotEmptyString } from '../utils/is'
import { getJwtToken, getJwtTokenPayload } from '../utils/helper'
import { formatDate } from '../utils/index'
import JSON_DB from '../utils/db'
import type { RequestProps } from '../types'

const MAX_REQUEST_PER_MINUTE = process.env.MAX_REQUEST_PER_MINUTE
const MAX_REQUEST_PER_HOUR = process.env.MAX_REQUEST_PER_HOUR
const MAX_REQUEST_PER_DAY = process.env.MAX_REQUEST_PER_DAY
const MAX_BLACKLIST_TIME = process.env.MAX_BLACKLIST_TIME
const MAX_BLACKLIST_LIMITER_COUNT = process.env.MAX_BLACKLIST_LIMITER_COUNT
const FRYENDLY_TIPS = process.env.FRYENDLY_TIPS
const FIRST_REQUEST_TIPS = process.env.FIRST_REQUEST_TIPS || ''

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

const dataStatisticsDbOpts = {
  dir: './',
  name: 'data_statistics',
  useDayId: true,
}

/* 统计通过速率限制后的请求，以便进一步识别滥用情况 */
async function dataStatistics(req: Request, userInfo: any, realIp: string, token: string) {
  const reqBody = req.body as RequestProps
  const ua = req.headers['user-agent']
  const db = await JSON_DB.get(dataStatisticsDbOpts)
  const dbData = db.data = db.data ? db.data : { ipInfo: {}, data: {}, total: 0 }
  const currentTimestamp = Date.now()

  /* token维度的统计 */
  dbData.total += 1
  const tokenData = dbData.data[token] = dbData.data[token] ? dbData.data[token] : { createdAt: currentTimestamp, count: 0, prompts: [], ip: [], humanTimestamp: [], timestamp: [], userInfo }
  tokenData.count += 1
  tokenData.ip.includes(realIp) || tokenData.ip.push(realIp)
  tokenData.timestamp.push(currentTimestamp)
  tokenData.prompts.push(reqBody.prompt)

  if (!tokenData.humanTimestamp)
    tokenData.humanTimestamp = []
  tokenData.humanTimestamp.push(formatDate(currentTimestamp, 'HH:mm:ss'))

  /* ip维度的统计 */
  const ipData = dbData.ipInfo[realIp] = dbData.ipInfo[realIp] ? dbData.ipInfo[realIp] : { createdAt: currentTimestamp, count: 0, token: [], devices: [], humanTimestamp: [], timestamp: [] }
  ipData.count += 1
  ipData.token.includes(token) || ipData.token.push(token)
  ipData.devices.includes(ua) || ipData.devices.push(ua)
  ipData.timestamp.push(currentTimestamp)

  if (!ipData.humanTimestamp)
    ipData.humanTimestamp = []
  ipData.humanTimestamp.push(formatDate(currentTimestamp, 'HH:mm:ss'))

  JSON_DB.save(dataStatisticsDbOpts)

  return dbData
}

/**
 * https://github.com/animir/node-rate-limiter-flexible/wiki/Memory
 * https://github.com/animir/node-rate-limiter-flexible/wiki/Options
 */
const rateLimiterSession = new RateLimiterMemory({
  points: LIMIT_MAP.MAX_REQUEST_PER_MINUTE,
  /* 一分钟 */
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

const friendlyTips = LIMIT_MAP.FRYENDLY_TIPS || '\n\n[温馨提示]\n为了让更多人连接到AI的世界，建议提升问题质量并理性提问。 \n服务器小，请轻点使用~\n'

const rateLimiter = async (req: Request, res: Response, next) => {
  const userInfo = getJwtTokenPayload(req)

  if (!userInfo) {
    res.send({ status: 'Unauthorized', message: '鉴权失败，请刷新重试或联系管理员 | Authentication failed, please refresh and try again or contact the administrator', data: null })
    return
  }

  const token = getJwtToken(req)
  const realIp = (req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || req.ip) as string
  const limitCharacter = userInfo.userId === '-1' ? token : `${userInfo.userId}-${token}`

  const db = await JSON_DB.get(limitIpDbOpts)
  const dbData = db.data = db.data ? db.data : { blacklist: {}, whitelist: {} }

  /* 如果ip处于白名单列表，则直接放行 */
  if (dbData.whitelist[realIp]) {
    next()
    try {
      dataStatistics(req, userInfo, realIp, token)
    }
    catch (e) {
      global.console.error('[rateLimiter][dataStatistics][error]', e)
    }
    return
  }

  /* 如果ip处于黑名单列表，则直接拒绝 */
  if (dbData.blacklist[realIp]) {
    const blackInfo = dbData.blacklist[realIp]
    const hasUnLock = Date.now() - blackInfo.canUseAt > 0

    /* 对进过小黑屋但已解封的ip需保持警惕 */
    if (!blackInfo.isInPrison && hasUnLock) {
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

  /* IP限位器(按小时限流) */
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

  /* 会话限位器（按会话信息或设备信息进行限流） */
  try {
    await rateLimiterSession.consume(limitCharacter)
    try {
      const statisticsInfo = await dataStatistics(req, userInfo, realIp, token)

      /**
       * 根据本地统计信息，判断ip是否需要限流，
       * 再次进行限流判断的原因是rateLimiterIpByDay是基于内存的
       * 程序重启后内存数据就丢掉了
       * 而本地统计信息是基于JSON文件的，程序重启后数据依然存在，这样就可以保证程序重启后，ip的限流依然有效
       */
      if (statisticsInfo.ipInfo && statisticsInfo.ipInfo[realIp] && statisticsInfo.ipInfo[realIp].count > LIMIT_MAP.MAX_REQUEST_PER_DAY) {
        res.status(200).send({
          status: 'Fail',
          message: `\n[System Info]\n当前IP(${realIp})一天内发起的请求太多 | Too many request from this IP(${realIp}) in 1 day ${friendlyTips}`,
          data: null,
        })

        return
      }

      if (statisticsInfo.data && statisticsInfo.data[token] && statisticsInfo.data[token].count === 1) {
        /* 首次请求的提示或问答说明 */
        if (FIRST_REQUEST_TIPS) {
          res.status(200).send({
            status: 'Fail',
            message: FIRST_REQUEST_TIPS,
            data: null,
          })

          // console.log(`[System Info] First request from ${realIp}(${limitCharacter})`, FIRST_REQUEST_TIPS)
          return
        }
      }
    }
    catch (err) {
      global.console.error('[rateLimiter][dataStatistics][error]', err)
      throw err
    }

    next()
  }
  catch (err) {
    res.status(200).send({
      status: 'Fail',
      message: `\n[System Info]\n当前对话一分钟内发起的请求太多 | Too many request from this chat in 1 minute${friendlyTips}`,
      data: null,
    })
  }
}

export { rateLimiter }
