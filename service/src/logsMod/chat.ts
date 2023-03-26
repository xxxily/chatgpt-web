import type { Request, Response } from 'express'
import JSON_DB from '../utils/db'
import type { RequestProps } from '../types'

const chatDbOpts = {
  dir: './',
  name: 'chat',
  useDayId: true,
}

export default async function logsChat(req: Request, res: Response, chatData: any) {
  const db = await JSON_DB.get(chatDbOpts)
  const dbData = db.data = db.data ? db.data : { chatList: [] }
  const reqBody = req.body as RequestProps

  let chat = {
    data: [],
    createdAt: new Date(),
  }

  let hasOldChat = false

  if (reqBody.options && reqBody.options.parentMessageId) {
    const oldChat = dbData.chatList.find(chat => chat.data[chat.data.length - 1].id === reqBody.options.parentMessageId.parentMessageId)
    chat = oldChat || chat

    if (oldChat)
      hasOldChat = true
  }

  /* 存储聊天记录 */
  chat.data.push({
    createdAt: new Date(),
    reqInfo: {
      ip: req.headers['x-real-ip'] || req.ip,
      ua: req.headers['user-agent'],
    },
    prompt: reqBody.prompt,
    ...chatData,
  })

  if (!hasOldChat)
    dbData.chatList.push(chat)

  await JSON_DB.save(chatDbOpts)
}
