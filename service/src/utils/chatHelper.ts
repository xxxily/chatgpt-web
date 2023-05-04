interface ChatRule {
  matchHandler?: (prompt: string) => boolean
  matchText?: string | string[]
  matchTextRule?: 'some' | 'every'
  responseType: 'systemMessage' | 'prompt' | 'reply'
  responseContent: string | string[]
}

const chatRules: ChatRule[] = [
  {
    // matchHandler: (message: string) => message === 'hi',
    matchText: ['hi', 'hello', '你好', '您好', '嗨', '哈喽', '哈囉', '哈嘍'],
    matchTextRule: 'some',
    responseType: 'systemMessage', // systemMessage | prompt | reply
    responseContent: '',
  },
]

global.console.log(chatRules)

const chatHelper = {
  getChatRules: () => chatRules,

  addChatRule: (rule: ChatRule) => {
    chatRules.push(rule)
  },

  removeChatRule: (rule: ChatRule) => {
    const index = chatRules.indexOf(rule)
    if (index > -1)
      chatRules.splice(index, 1)
  },

  getChatRule: (rule: ChatRule) => {
    const index = chatRules.indexOf(rule)
    if (index > -1)
      return chatRules[index]
  },

  updateChatRule: (rule: ChatRule) => {
    const index = chatRules.indexOf(rule)
    if (index > -1)
      chatRules[index] = rule
  },

  getChatRuleByMatchText: (text: string) => {
    return chatRules.find((rule) => {
      if (rule.matchText) {
        const matchText = Array.isArray(rule.matchText) ? rule.matchText : [rule.matchText]
        const matchTextRule = rule.matchTextRule || 'some'

        if (matchTextRule === 'every')
          return matchText.every(item => item.includes(text))
        else
          return matchText.some(item => item.includes(text))
      }
      else {
        return false
      }
    })
  },

  getChatRuleByMatchHandler: (text: string) => {
    return chatRules.find((rule) => {
      if (rule.matchHandler)
        return rule.matchHandler(text)
      else
        return false
    })
  },
}

export default chatHelper
