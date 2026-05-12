import path from 'node:path'
import { defineConfig, env } from 'prisma/config'

// Load .env from monorepo root (two levels up from packages/db)
const envPath = path.resolve(__dirname, '../../.env')
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('dotenv').config({ path: envPath })
} catch {
  // dotenv not available; DATABASE_URL must be set in the environment
}

type Env = {
  DATABASE_URL: string
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: env<Env>('DATABASE_URL'),
  },
})
