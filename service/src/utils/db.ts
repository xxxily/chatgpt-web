import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { mkdirSync } from 'fs'
import { Low } from 'lowdb'
import { JSONFile } from 'lowdb/node'

export interface LowdbData {
  [prop: string | number | symbol]: any
}

const __dirname = dirname(fileURLToPath(import.meta.url))
const rootPath = join(__dirname, '../../../.db')

/* 确保rootPath文件的存在 */
mkdirSync(rootPath, { recursive: true })

const dbList = {}

export async function getDatabase() {
  const curTime = new Date()
  const dayId = `${curTime.getFullYear()}-${curTime.getMonth() + 1}-${curTime.getDate()}`

  if (dbList[dayId] && dbList[dayId].data)
    return dbList[dayId]

  /* 移除旧的数据库文件，防止内存堆积 */
  for (const key in dbList) {
    if (key !== dayId)
      delete dbList[key]
  }

  const file = join(rootPath, `db_${dayId}.json`)
  const db = new Low(new JSONFile<LowdbData>(file))
  await db.read()

  dbList[dayId] = db

  return db
}
