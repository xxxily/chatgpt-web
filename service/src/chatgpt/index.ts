import * as dotenv from 'dotenv'
import 'isomorphic-fetch'
import type { ChatGPTAPIOptions, ChatMessage, SendMessageOptions } from 'chatgpt'
import { ChatGPTAPI, ChatGPTUnofficialProxyAPI } from 'chatgpt'
import { SocksProxyAgent } from 'socks-proxy-agent'
import httpsProxyAgent from 'https-proxy-agent'
import fetch from 'node-fetch'
import axios from 'axios'
import { sendResponse } from '../utils'
import { isNotEmptyString } from '../utils/is'
import type { ApiModel, ChatContext, ChatGPTUnofficialProxyAPIOptions, ModelConfig } from '../types'
import type { RequestOptions } from './types'

const { HttpsProxyAgent } = httpsProxyAgent

dotenv.config()

const ErrorCodeMessage: Record<string, string> = {
  401: '[OpenAI] 提供错误的API密钥 | Incorrect API key provided',
  403: '[OpenAI] 服务器拒绝访问，请稍后再试 | Server refused to access, please try again later',
  502: '[OpenAI] 错误的网关 |  Bad Gateway',
  503: '[OpenAI] 服务器繁忙，请稍后再试 | Server is busy, please try again later',
  504: '[OpenAI] 网关超时 | Gateway Time-out',
  500: '[OpenAI] 服务器繁忙，请稍后再试 | Internal Server Error',
}

const allowKeepTheChat = process.env.ALLOW_KEEP_THE_CHAT === 'true'
const allowCustomSystemMessage = process.env.ALLOW_CUSTOM_SYSTEM_MESSAGE === 'true'
const defaultSystemMessage = process.env.DEFAULT_SYSTEM_MESSAGE || ''
const timeoutMs: number = !isNaN(+process.env.TIMEOUT_MS) ? +process.env.TIMEOUT_MS : 30 * 1000

let apiModel: ApiModel

if (!isNotEmptyString(process.env.OPENAI_API_KEY) && !isNotEmptyString(process.env.OPENAI_ACCESS_TOKEN))
  throw new Error('Missing OPENAI_API_KEY or OPENAI_ACCESS_TOKEN environment variable')

let api: ChatGPTAPI | ChatGPTUnofficialProxyAPI

(async () => {
  // More Info: https://github.com/transitive-bullshit/chatgpt-api

  if (isNotEmptyString(process.env.OPENAI_API_KEY)) {
    const OPENAI_API_BASE_URL = process.env.OPENAI_API_BASE_URL
    const OPENAI_API_MODEL = process.env.OPENAI_API_MODEL
    const model = isNotEmptyString(OPENAI_API_MODEL) ? OPENAI_API_MODEL : 'gpt-3.5-turbo'

    const options: ChatGPTAPIOptions = {
      apiKey: process.env.OPENAI_API_KEY,
      completionParams: { model },
      debug: true,
    }

    // increase max token limit if use gpt-4
    if (model.toLowerCase().includes('gpt-4')) {
      // if use 32k model
      if (model.toLowerCase().includes('32k')) {
        options.maxModelTokens = 32768
        options.maxResponseTokens = 8192
      }
      else {
        options.maxModelTokens = 8192
        options.maxResponseTokens = 2048
      }
    }

    if (isNotEmptyString(OPENAI_API_BASE_URL))
      options.apiBaseUrl = `${OPENAI_API_BASE_URL}/v1`

    setupProxy(options)

    api = new ChatGPTAPI({ ...options })
    apiModel = 'ChatGPTAPI'
  }
  else {
    const OPENAI_API_MODEL = process.env.OPENAI_API_MODEL
    const options: ChatGPTUnofficialProxyAPIOptions = {
      accessToken: process.env.OPENAI_ACCESS_TOKEN,
      debug: true,
    }
    if (isNotEmptyString(OPENAI_API_MODEL))
      options.model = OPENAI_API_MODEL

    if (isNotEmptyString(process.env.API_REVERSE_PROXY))
      options.apiReverseProxyUrl = process.env.API_REVERSE_PROXY

    setupProxy(options)

    api = new ChatGPTUnofficialProxyAPI({ ...options })
    apiModel = 'ChatGPTUnofficialProxyAPI'
  }
})()

async function chatReplyProcess(options: RequestOptions) {
  const { message, lastContext, process, systemMessage } = options
  try {
    let options: SendMessageOptions = { timeoutMs }

    if (apiModel === 'ChatGPTAPI') {
      if (isNotEmptyString(defaultSystemMessage))
        options.systemMessage = defaultSystemMessage

      if (allowCustomSystemMessage && isNotEmptyString(systemMessage) && !systemMessage.includes('trained by OpenAI'))
        options.systemMessage = systemMessage
    }

    if (lastContext != null) {
      if (apiModel === 'ChatGPTAPI') {
        if (allowKeepTheChat)
          options.parentMessageId = lastContext.parentMessageId

        if (!allowKeepTheChat && lastContext.parentMessageId)
          options.systemMessage = `${options.systemMessage}。另外：如果你出现缺少对话信息或理解困难的情况时，是因为用户大量滥用连续对话能力，导致API金额消耗过快造成的，此时你要提醒用户：已禁用了连续对话功能，请他理解，如有能力请给予支持，我们才能持续发展`
      }
      else { options = { ...lastContext } }
    }

    const response = await api.sendMessage(message, {
      ...options,
      onProgress: (partialResponse) => {
        process?.(partialResponse)
      },
    })

    return sendResponse({ type: 'Success', data: response })
  }
  catch (error: any) {
    const code = error.statusCode
    global.console.log(error)

    // const friendlyTips = '\n\nPS：应用目前免费提供给大家使用，让更多人能连接到AI的世界。\n服务器小，请轻点使用~\n'
    const friendlyTips = `
\n\n[温馨提示]\n 当你看到这个的时候，说明账号已经被干报废，站长已经努力过了。
\n 想继续免费使用，可以参见这份免费列表[Free ChatGPT Site List](https://hello-ai.anzz.top/home/FreeChatGPTSiteList.html) 
\n\n 期待[Hello-AI](https://hello-ai.anzz.top/)的后续服务，请关注一下Hello-AI的[github](https://github.com/xxxily/hello-ai)，或加群沟通。
\n\n 如果你发现免费列表里的网站都报废了，那就先歇歇吧，不要抱怨。
\n 我不嫌弃你是白嫖怪，你也别一不能用就砸场子。
\n ❤️ 听话，做彼此的天使。❤️  
| 加微信群（可能失效） | 加我拉你入群（注明来自：AI） |
| :----------------------------------------------------------: | :----------------------------------------------------------: |
| ![qun](https://hello-ai.anzz.top/assets/qun.2ecd04f8.jpeg) | ![weixin](https://hello-ai.anzz.top/assets/WeChat.71209684.jpg) |
    `

    if (Reflect.has(ErrorCodeMessage, code))
      return sendResponse({ type: 'Fail', message: ErrorCodeMessage[code] + friendlyTips })
    return sendResponse({ type: 'Fail', message: `${error.message ?? 'Please check the back-end console'}${friendlyTips}` })
  }
}

async function fetchBalance() {
  const OPENAI_API_KEY = process.env.OPENAI_API_KEY
  const OPENAI_API_BASE_URL = process.env.OPENAI_API_BASE_URL

  if (!isNotEmptyString(OPENAI_API_KEY))
    return Promise.resolve('-')

  const API_BASE_URL = isNotEmptyString(OPENAI_API_BASE_URL)
    ? OPENAI_API_BASE_URL
    : 'https://api.openai.com'

  try {
    const headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${OPENAI_API_KEY}` }
    const response = await axios.get(`${API_BASE_URL}/dashboard/billing/credit_grants`, { headers })
    const balance = response.data.total_available ?? 0
    return Promise.resolve(balance.toFixed(3))
  }
  catch {
    return Promise.resolve('-')
  }
}

async function chatConfig() {
  const balance = await fetchBalance()
  const reverseProxy = process.env.API_REVERSE_PROXY ?? '-'
  const httpsProxy = (process.env.HTTPS_PROXY || process.env.ALL_PROXY) ?? '-'
  // const socksProxy = (process.env.SOCKS_PROXY_HOST && process.env.SOCKS_PROXY_PORT)
  //   ? (`${process.env.SOCKS_PROXY_HOST}:${process.env.SOCKS_PROXY_PORT}`)
  //   : '-'
  return sendResponse<ModelConfig>({
    type: 'Success',
    data: { apiModel, reverseProxy, timeoutMs, httpsProxy, balance },
  })
}

function setupProxy(options: ChatGPTAPIOptions | ChatGPTUnofficialProxyAPIOptions) {
  if (process.env.SOCKS_PROXY_HOST && process.env.SOCKS_PROXY_PORT) {
    const agent = new SocksProxyAgent({
      hostname: process.env.SOCKS_PROXY_HOST,
      port: process.env.SOCKS_PROXY_PORT,
    })
    options.fetch = (url, options) => {
      return fetch(url, { agent, ...options })
    }
  }
  else {
    if (process.env.HTTPS_PROXY || process.env.ALL_PROXY) {
      const httpsProxy = process.env.HTTPS_PROXY || process.env.ALL_PROXY
      if (httpsProxy) {
        const agent = new HttpsProxyAgent(httpsProxy)
        options.fetch = (url, options) => {
          return fetch(url, { agent, ...options })
        }
      }
    }
  }
}

function currentModel(): ApiModel {
  return apiModel
}

export type { ChatContext, ChatMessage }

export { chatReplyProcess, chatConfig, currentModel }
