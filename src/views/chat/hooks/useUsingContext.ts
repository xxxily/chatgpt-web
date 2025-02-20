import { computed } from 'vue'
import { useMessage } from 'naive-ui'
import { t } from '@/locales'
import { useChatStore } from '@/store'

export function useUsingContext() {
  const ms = useMessage()
  const chatStore = useChatStore()
  const usingContext = computed<boolean>(() => chatStore.usingContext)

  function toggleUsingContext() {
    chatStore.setUsingContext(!usingContext.value)
    if (usingContext.value) {
      ms.warning(t('chat.turnOnContext'), {
        duration: 1000 * 8,
      })
    }
    else { ms.success(t('chat.turnOffContext')) }
  }

  return {
    usingContext,
    toggleUsingContext,
  }
}
