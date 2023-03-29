import crypto from 'crypto'

interface SendResponseOptions<T = any> {
  type: 'Success' | 'Fail'
  message?: string
  data?: T
}

export function sendResponse<T>(options: SendResponseOptions<T>) {
  if (options.type === 'Success') {
    return Promise.resolve({
      message: options.message ?? null,
      data: options.data ?? null,
      status: options.type,
    })
  }

  // eslint-disable-next-line prefer-promise-reject-errors
  return Promise.reject({
    message: options.message ?? 'Failed',
    data: options.data ?? null,
    status: options.type,
  })
}

/* 根据给定字符串生成字符串对应的md5 */
export function md5(str: string) {
  return crypto.createHash('md5').update(str).digest('hex')
}

export function getDayId() {
  const curTime = new Date()
  return `${curTime.getFullYear()}-${curTime.getMonth() + 1}-${curTime.getDate()}`
}

/**
 * 将时间戳转换为指定格式的时间字符串
 * @param timestamp {number} 时间戳
 * @param format {string} 格式化字符串
 * @returns
 */
export function formatDate(timestamp: number, format: string): string {
  const date: Date = new Date(timestamp)
  const year: number = date.getFullYear()
  const month: string = (date.getMonth() + 1).toString().padStart(2, '0')
  const day: string = date.getDate().toString().padStart(2, '0')
  const hour: string = date.getHours().toString().padStart(2, '0')
  const minute: string = date.getMinutes().toString().padStart(2, '0')
  const second: string = date.getSeconds().toString().padStart(2, '0')

  const formatMap: Record<string, any> = {
    yyyy: year,
    MM: month,
    dd: day,
    HH: hour,
    mm: minute,
    ss: second,
  }

  return format.replace(/yyyy|MM|dd|HH|mm|ss/g, (match: string) => formatMap[match])
}
