/* 对ChatGPTAPI模型进行增删改查的模块 */
import type { ChatGPTAPIOptions } from 'chatgpt'
import { getDayId } from '../utils/index'
import JSON_DB from '../utils/db'

const chatGPTModel = (async () => {
  const chatGPTModelDBOpts = {
    dir: './ChatGPT/model',
    name: 'chatGPTModel',
    useDayId: false,
  }

  const db = await JSON_DB.get(chatGPTModelDBOpts)
  const dbData = db.data = db.data ? db.data : { chatGPTModelList: [] }

  /* 为了保证数据安全，每次修改数据前都会进行备份 */
  async function backupsModel(data: any, action: string) {
    const chatGPTModelDBBackupsOpts = {
      dir: `${chatGPTModelDBOpts.dir}/${getDayId()}`,
      name: `${chatGPTModelDBOpts.name}_backups_${action}_${Date.now()}`,
      useDayId: false,
    }

    if (data && data.chatGPTModelList && data.chatGPTModelList.length > 0) {
      const db = await JSON_DB.get(chatGPTModelDBBackupsOpts, false)
      db.data = data

      await JSON_DB.save(chatGPTModelDBBackupsOpts)
    }
  }

  const api = {
    /* 创建ChatGPTAPI模型 */
    async create(opts: ChatGPTAPIOptions) {
      const { apiKey } = opts

      if (!apiKey)
        throw new Error('apiKey是必须的 | apiKey is required!')

      const chatGPTModel = dbData.chatGPTModelList.find(chatGPTModel => chatGPTModel.apiKey === apiKey)

      if (chatGPTModel)
        throw new Error('apiKey已存在 | apiKey already exists!')

      dbData.chatGPTModelList.push(opts)

      await JSON_DB.save(chatGPTModelDBOpts)
      await backupsModel(dbData, 'create')
    },

    /* 删除ChatGPTAPI模型 */
    async delete(apiKey: string) {
      const chatGPTModel = dbData.chatGPTModelList.find(chatGPTModel => chatGPTModel.apiKey === apiKey)

      if (!chatGPTModel)
        throw new Error('apiKey不存在 | apiKey does not exist!')

      await backupsModel(dbData, 'delete')

      dbData.chatGPTModelList = dbData.chatGPTModelList.filter(chatGPTModel => chatGPTModel.apiKey !== apiKey)

      await JSON_DB.save(chatGPTModelDBOpts)
    },

    /* 更新ChatGPTAPI模型 */
    async update(opts: ChatGPTAPIOptions) {
      const { apiKey } = opts

      if (!apiKey)
        throw new Error('apiKey是必须的 | apiKey is required!')

      const chatGPTModel = dbData.chatGPTModelList.find(chatGPTModel => chatGPTModel.apiKey === apiKey)

      if (!chatGPTModel)
        throw new Error('apiKey不存在 | apiKey does not exist!')

      if (JSON.stringify(chatGPTModel) !== JSON.stringify(opts)) {
        global.console.log('[chatGPTModel][update] 没有内容变化，不进行修改 | No content change, no modification')
        return
      }

      await backupsModel(dbData, 'update')

      Object.assign(chatGPTModel, opts)

      await JSON_DB.save(chatGPTModelDBOpts)
    },

    /* 查询ChatGPTAPI模型 */
    async query(apiKey: string) {
      const chatGPTModel = dbData.chatGPTModelList.find(chatGPTModel => chatGPTModel.apiKey === apiKey)

      if (!chatGPTModel)
        throw new Error('apiKey不存在 | apiKey does not exist!')

      return chatGPTModel
    },
  }

  return api
})()

export default chatGPTModel
