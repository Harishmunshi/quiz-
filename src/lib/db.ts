import { PrismaClient } from '@prisma/client'

/**
 * Prisma singleton.
 *
 * On Vercel every serverless invocation may spin up a fresh module instance.
 * Caching the client on globalThis keeps warm lambdas from opening a new
 * connection pool on every request, which is what exhausts Supabase's
 * connection limit during a live event with 100+ students hitting the API.
 *
 * `log: ['query']` is intentionally NOT enabled in production — it writes a
 * line to the Vercel log drain for every single query and materially slows
 * request handling under load.
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'production' ? ['error'] : ['error', 'warn'],
  })

// Cache in every environment. On Vercel this survives across warm invocations
// of the same lambda instance, which is exactly what we want.
globalForPrisma.prisma = db
