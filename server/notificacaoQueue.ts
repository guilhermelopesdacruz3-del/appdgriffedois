import { Queue } from "bullmq";
import IORedis from "ioredis";

const redisUrl = process.env.REDIS_URL || process.env.UPSTASH_REDIS_REST_URL || "";
export const notifQueue = redisUrl
  ? new Queue(
      "notificacoes",
      {
        connection: new IORedis(redisUrl, { maxRetriesPerRequest: null, enableReadyCheck: false }),
        defaultJobOptions: { attempts: 5, backoff: { type: "exponential", delay: 1000 }, removeOnComplete: true, removeOnFail: false },
      }
    )
  : null;

export type NotificacaoPayload = { titulo: string; corpo: string; tipo: string; email: string };

export async function enfileirarNotificacao(p: NotificacaoPayload) {
  if (!notifQueue) return null;
  const job = await notifQueue.add("enviar", p, { removeOnComplete: true });
  return job.id;
}
