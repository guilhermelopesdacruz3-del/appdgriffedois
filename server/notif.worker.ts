import { Worker } from "bullmq";
import IORedis from "ioredis";
import type { NotificacaoPayload } from "../server/notificacaoQueue";

const redisUrl = process.env.REDIS_URL || process.env.UPSTASH_REDIS_REST_URL || "";
if (!redisUrl) {
  console.warn("[notif-worker] REDIS_URL/UPSTASH_REDIS_REST_URL não definida — worker NÃO inicia.");
  process.exit(0);
}

const connection = new IORedis(redisUrl, { maxRetriesPerRequest: null, enableReadyCheck: false });

const worker = new Worker<NotificacaoPayload>(
  "notificacoes",
  async (job) => {
    const { titulo, corpo, tipo, email } = job.data;
    // Backend já salva a notificação no banco; aqui podemos colocar passo extra de entrega externa depois.
    console.log(`[notif-worker] enviado para ${email}: ${titulo}`);
    return { ok: true };
  },
  { connection, concurrency: 10 }
);

worker.on("error", (err) => console.error("[notif-worker] erro:", err));

process.on("SIGINT", async () => {
  await worker.close();
  await connection.quit();
  process.exit(0);
});
