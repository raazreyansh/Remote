import { startJobWorker } from "./services/jobs";

startJobWorker();

setInterval(() => {
  // Keep the worker process alive for containerized deployments.
}, 60_000);
