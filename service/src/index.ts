import express from 'express'
import cookieParser from 'cookie-parser'
import type { RequestProps } from './types'
import type { ChatMessage } from './chatgpt'
import { chatConfig, chatReplyProcess, currentModel } from './chatgpt'
import { auth } from './middleware/auth'
import { rateLimiter } from './middleware/rateLimiter'
import { commonLimiter } from './middleware/commonLimiter'
import { strlen } from './middleware/strlen'
import { isNotEmptyString } from './utils/is'
import logsChat from './logsMod/chat'
// import logsPrompt from './logsMod/prompt'
import { createTempJwtToken, verifyJwtToken } from './utils/helper'

const app = express()
const router = express.Router()

app.use(express.static('public'))
app.use(express.json())
app.use(cookieParser())

app.all('*', (_, res, next) => {
  res.header('Access-Control-Allow-Origin', '*')
  res.header('Access-Control-Allow-Headers', 'authorization, Content-Type')
  res.header('Access-Control-Allow-Methods', '*')
  next()
})

router.post('/chat-process', [
  auth,

  /* 请求频率限制中间件 */
  rateLimiter,

  /* 字符串长度限制中间件 */
  strlen({
    field: 'prompt',
  }),
], async (req, res) => {
  res.setHeader('Content-type', 'application/octet-stream')

  // try {
  //   logsPrompt(req)
  // }
  // catch (err) {
  //   console.error('[logsPrompt error]', err)
  // }

  try {
    const { prompt, options = {}, systemMessage } = req.body as RequestProps
    let firstChunk = true
    const result = await chatReplyProcess({
      message: prompt,
      lastContext: options,
      process: (chat: ChatMessage) => {
        res.write(firstChunk ? JSON.stringify(chat) : `\n${JSON.stringify(chat)}`)
        firstChunk = false
      },
      systemMessage,
    })

    try {
      logsChat(req, res, result)
    }
    catch (err) {
      console.error('[logsChat error]', err)
    }
  }
  catch (error) {
    res.write(JSON.stringify(error))
  }
  finally {
    res.end()
  }
})

router.post('/config', auth, async (req, res) => {
  try {
    const response = await chatConfig()
    res.send(response)
  }
  catch (error) {
    res.send(error)
  }
})

router.post('/session', async (req, res) => {
  try {
    if (!req.cookies['ACCESS-TOKEN'] && !req.cookies['TEMP-ACCESS-TOKEN']) {
      /* 给未登录用户设置临时token */
      res.cookie('TEMP-ACCESS-TOKEN', createTempJwtToken(), { maxAge: 1000 * 60 * 60 * 24 * 60, httpOnly: true })
    }

    const AUTH_SECRET_KEY = process.env.AUTH_SECRET_KEY
    const hasAuth = isNotEmptyString(AUTH_SECRET_KEY)
    res.send({ status: 'Success', message: '', data: { auth: hasAuth, model: currentModel() } })
  }
  catch (error) {
    res.send({ status: 'Fail', message: error.message, data: null })
  }
})

router.post('/verify', async (req, res) => {
  try {
    const { token } = req.body as { token: string }
    if (!token)
      throw new Error('Secret key is empty')

    if (process.env.AUTH_SECRET_KEY !== token)
      throw new Error('密钥无效 | Secret key is invalid')

    res.send({ status: 'Success', message: 'Verify successfully', data: null })
  }
  catch (error) {
    res.send({ status: 'Fail', message: error.message, data: null })
  }
})

router.post('/verify-vipkey', [commonLimiter], async (req, res) => {
  try {
    const { token } = req.body as { token: string }
    if (!token)
      throw new Error('Token empty')

    try {
      const userInfo = verifyJwtToken(token)

      if (!userInfo)
        throw new Error('Token is invalid')
    }
    catch (error) {
      throw new Error('授权码无效 | Token is invalid')
    }

    res.send({ status: 'Success', message: 'Verify successfully', data: null })
  }
  catch (error) {
    res.send({ status: 'Fail', message: error.message, data: null })
  }
})

app.use('', router)
app.use('/api', router)
app.set('trust proxy', 1)

app.listen(3002, () => globalThis.console.log('Server is running on port 3002'))
