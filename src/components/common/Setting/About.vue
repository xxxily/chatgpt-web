<script setup lang='ts'>
import { computed, onMounted, ref } from 'vue'
import { NSpin } from 'naive-ui'
import { fetchChatConfig } from '@/api'
import pkg from '@/../package.json'
import { useAuthStore } from '@/store'

interface ConfigState {
  timeoutMs?: number
  reverseProxy?: string
  apiModel?: string
  socksProxy?: string
  httpsProxy?: string
  balance?: string
}

const authStore = useAuthStore()

const loading = ref(false)

const config = ref<ConfigState>()

const isChatGPTAPI = computed<boolean>(() => !!authStore.isChatGPTAPI)

async function fetchConfig() {
  try {
    loading.value = true
    const { data } = await fetchChatConfig<ConfigState>()
    config.value = data
  }
  finally {
    loading.value = false
  }
}

onMounted(() => {
  fetchConfig()
})
</script>

<template>
  <NSpin :show="loading">
    <div class="p-4 space-y-4">
      <h2 class="text-xl font-bold">
        Version - {{ pkg.version }}
      </h2>
      <div class="p-2 space-y-2 rounded-md bg-neutral-100 dark:bg-neutral-700">
        <p>
          此应用基于
          <a
            class="text-blue-600 dark:text-blue-500"
            href="https://github.com/Chanzhaoyu/chatgpt-web"
            target="_blank"
          >
            chatgpt-web
          </a>
        </p>
        <p>目前免费提供给大家使用，让更多人能连接到AI的世界。</p>
        <p>服务器小，请轻点使用~</p>
      </div>

      <div class="p-2 space-y-2 rounded-md bg-neutral-100 dark:bg-neutral-700">
        <p>
          如果觉得网站对你有帮助，请给作者的其他作品，点个 Star 或者给予一点赞助，谢谢！
        </p>
        <p>
          -
          <a
            class="text-blue-600 dark:text-blue-500"
            href="https://h5player.anzz.top/"
            target="_blank"
          >
            HTML5视频增强脚本
          </a>
        </p>
        <p>
          -
          <a
            class="text-blue-600 dark:text-blue-500"
            href="https://broadcast-message.anzz.top/"
            target="_blank"
          >
            broadcast-message
          </a>
        </p>
        <p>
          -
          <a
            class="text-blue-600 dark:text-blue-500"
            href="https://github.com/xxxily/monkey-script/tree/main/apps/web-record"
            target="_blank"
          >
            web-record
          </a>
        </p>
        <p>
          -
          <a
            class="text-blue-600 dark:text-blue-500"
            href="https://github.com/xxxily/Fiddler-plus"
            target="_blank"
          >
            Fiddler plus
          </a>
        </p>
        <p>
          -
          <a
            class="text-blue-600 dark:text-blue-500"
            href="https://github.com/xxxily/ffmpeg-script"
            target="_blank"
          >
            ffmpeg-script
          </a>
        </p>
      </div>

      <p>{{ $t("setting.api") }}：{{ config?.apiModel ?? '-' }}</p>
      <p v-if="isChatGPTAPI">
        {{ $t("setting.balance") }}：{{ config?.balance ?? '-' }}
      </p>
      <p v-if="!isChatGPTAPI">
        {{ $t("setting.reverseProxy") }}：{{ config?.reverseProxy ?? '-' }}
      </p>
      <p>{{ $t("setting.timeout") }}：{{ config?.timeoutMs ?? '-' }}</p>
      <p>{{ $t("setting.socks") }}：{{ config?.socksProxy ?? '-' }}</p>
      <p>{{ $t("setting.httpsProxy") }}：{{ config?.httpsProxy ?? '-' }}</p>
    </div>
  </NSpin>
</template>
