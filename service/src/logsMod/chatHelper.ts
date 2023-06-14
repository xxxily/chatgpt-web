import axios from 'axios'
const apiUrl = process.env.STRAPI_URL
const apiToken = process.env.STRAPI_TOKEN

export interface OpenAIModel {
  id: string
  name: string
  maxLength: number
  tokenLimit: number
}

export type Role = 'assistant' | 'user'

export interface Message {
  role: Role
  content: string
}

export interface ChatBody {
  messages: Message[]
  key: string
  prompt: string
  temperature: number
  model?: OpenAIModel
  id?: string
  /* 支持任意参数 */
  [key: string]: any
}

/* axios设置headers的方法 */
const fetch = axios.create({
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${apiToken}`,
  },
})

export async function saveChat(data: ChatBody) {
  if (!apiUrl || !apiToken) {
    // console.error('[saveChat][error] 未定义后端接口信息，无法执行saveChat操作')
    return
  }

  if (!data.messages || !data.messages.length) {
    console.error('[saveChat][error] 确实相关字段')
    return
  }

  const result = {
    title: (data.title || data.messages[0]?.content || '').slice(0, 260),
    uuid: data.uuid || data.deviceId || data.realIp || Date.now(),
    ip: data.realIp || data.ip || '',
    apikey: data.key || data.apikey,
    deviceId: data.deviceId || '',
    isPrivateKey: data.isPrivateKey || false,
    data: data.messages,
    userAgent: data.userAgent || '',
    referer: data.referer || '',
  }

  /* 修正1002这个固定uuid导致的bug */
  if (result.uuid && result.uuid.toString() === '1002')
    result.uuid = `1002_${Date.now()}`

  // global.console.log('----------[saveChat][result]----------', result)

  if (data.uuid) {
    const res = (await fetch({
      url: `${apiUrl}/chats?filters[uuid][$eq]=${data.uuid}`,
      method: 'GET',
    })).data as any

    /* 更新数据 */
    if (res.data && res.data.length) {
      const data = res.data[0]
      const id = data.id
      const attributes = data.attributes || {}

      result.data = attributes.data.concat(result.data)
      result.title = attributes.title

      const updateRes = (await fetch({
        url: `${apiUrl}/chats/${id}`,
        method: 'PUT',
        data: JSON.stringify({
          data: result,
        }),
      })).data as any

      // global.console.log('----------[saveChat][updateRes]----------', updateRes)

      return
    }
  }

  /* 新增数据 */
  const res = (await fetch({
    url: `${apiUrl}/chats`,
    method: 'POST',
    data: JSON.stringify({
      data: result,
    }),
  })).data as any

  // global.console.log('----------[saveChat][res]----------', res)
}
