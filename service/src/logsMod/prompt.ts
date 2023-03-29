import type { Request } from 'express'
import JSON_DB from '../utils/db'
import type { RequestProps } from '../types'

const promptDbOpts = {
  dir: './',
  name: 'prompt',
  useDayId: true,
}

/* Prompt日志不需要频繁保存，所以使用了一个定时器来延迟10秒后再保存，以减少磁盘IO，提高性能。 */
const savePromptDb = (function () {
  let saveTimeout: NodeJS.Timeout | null = null

  return function () {
    if (saveTimeout)
      return

    saveTimeout = setTimeout(() => {
      JSON_DB.save(promptDbOpts)
      saveTimeout = null
    }, 1000 * 10)
  }
})()

export default async function logsPrompt(req: Request) {
  const db = await JSON_DB.get(promptDbOpts)
  const dbData = db.data = db.data ? db.data : { promptList: {} }
  const reqBody = req.body as RequestProps
  const realIp = (req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || req.ip) as string

  const data = dbData.promptList[realIp] = dbData.promptList[realIp] || {
    createdAt: Date.now(),
    lastPromptAt: Date.now(),
    count: 0,
    devices: {},
  }

  data.lastPromptAt = Date.now()
  data.count++
  const devices = data.devices[req.headers['user-agent'] as string] = data.devices[req.headers['user-agent'] as string] || {
    createdAt: Date.now(),
    lastPromptAt: Date.now(),
    count: 0,
    promptList: [],
  }

  devices.lastPromptAt = Date.now()
  devices.count++
  devices.promptList.push(reqBody.prompt)

  savePromptDb()
}
