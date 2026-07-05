import { Redis } from "ioredis";
import { Queue, Worker } from "bullmq";

const connection = process.env.REDIS_URL
  ? new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    })
  : (null as any);

const queueName = "realflip-scraping";

export const scrapingQueue = connection
  ? new Queue(queueName, {
      connection,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: "exponential", delay: 5000 },
        removeOnComplete: { count: 100 },
        removeOnFail: { count: 50 },
      },
    })
  : null;

export function createScrapingWorker(
  handler: (job: any) => Promise<void>
) {
  if (!connection) {
    console.warn("No Redis connection. Jobs will run inline.");
    return null;
  }

  return new Worker(queueName, handler, {
    connection,
    concurrency: 1,
    limiter: { max: 1, duration: 10000 },
  });
}

export async function addScrapingJob(data: { portal?: string; all?: boolean }) {
  if (!scrapingQueue) {
    // Fallback: run synchronously if no Redis
    console.warn("No queue available, running inline scraping");
    return null;
  }

  return scrapingQueue.add("scrape", data, {
    jobId: `scrape-${Date.now()}`,
  });
}

export { connection as redis };
