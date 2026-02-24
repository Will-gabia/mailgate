export { getRedisConnection, closeRedisConnection } from "./connection.js";
export { getEmailQueue, addEmailJob, closeEmailQueue, EMAIL_QUEUE_NAME } from "./email-queue.js";
export { startEmailWorker, stopEmailWorker } from "./email-processor.js";
export type { EmailJobData } from "./email-processor.js";