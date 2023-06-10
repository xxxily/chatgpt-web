import type { Request, Response } from 'express'
import JSON_DB from '../utils/db'
import type { RequestProps } from '../types'
import type { ChatBody } from './chatHelper'
import { saveChat } from './chatHelper'

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
    createdAt: Date.now(),
  }

  let hasOldChat = false

  if (reqBody.options && reqBody.options.parentMessageId) {
    const oldChat = dbData.chatList.find(chat => chat.data[chat.data.length - 1].id === reqBody.options.parentMessageId.parentMessageId)
    chat = oldChat || chat

    if (oldChat)
      hasOldChat = true
  }

  const chatBody: ChatBody = {
    messages: [
      {
        content: reqBody.prompt,
        role: 'user',
      },
      {
        content: chatData.data.text,
        role: 'assistant',
      },
    ],
    prompt: '',
    key: '',

    title: reqBody.prompt.slice(0, 260),
    uuid: reqBody.uuid || reqBody.options?.parentMessageId || chatData.data.id,
    realIp: req.headers['x-real-ip'] || req.ip,
    apikey: process.env.OPENAI_API_KEY || '',
    deviceId: req.cookies['ACCESS-TOKEN'] || req.cookies['TEMP-ACCESS-TOKEN'] || '',
    isPrivateKey: false,
    temperature: reqBody.temperature || 0.8,
    systemMessage: reqBody.systemMessage || '',
    userAgent: req.headers['user-agent'],
    referer: req.headers.referer,
  }

  try {
    saveChat(chatBody)
  }
  catch (err) {
    global.console.error('[logsChat][saveChat][error]', err)
  }

  /* 存储聊天记录 */
  chat.data.push({
    createdAt: Date.now(),
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
