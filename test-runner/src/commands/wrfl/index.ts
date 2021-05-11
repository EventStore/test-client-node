import { v4 as uuid } from "uuid";
import type { CommandModule } from "yargs";

import { performance, PerformanceObserver } from "perf_hooks";
import { Worker } from "worker_threads";
import { cpus } from "os";
// import { randomBytes } from "crypto";

import { Init, ResponseMsg, StreamMsg, WToPMsg } from "./types";
import { Clients } from "../../utils/client";

interface Options {
  client: Clients;
  connectionString: string;
  client_count: number;
  request_count: number;
  stream_count: number;
  size: number;
  batch_size: number;
  stream_prefix?: string;
  deterministic_stream_selection: boolean;
  worker_count: number;
  max_in_flight: number;
}

const wrfl: CommandModule<{}, Options> = {
  command: "wrfl",
  describe: "Multi Write Processor",
  builder: {
    client_count: {
      type: "number",
      demandOption: true,
    },
    request_count: {
      type: "number",
      demandOption: true,
    },
    stream_count: {
      type: "number",
      default: 1000,
    },
    size: { type: "number", default: 256 },
    batch_size: { type: "number", default: 1 },
    deterministic_stream_selection: {
      type: "boolean",
      default: false,
    },
    stream_prefix: {
      type: "string",
    },
    worker_count: {
      type: "number",
      default: Math.max(cpus().length - 1, 1),
    },
    max_in_flight: {
      type: "number",
      default: Infinity,
    },
  },
  handler,
};

async function handler({
  client_count: clientCount,
  stream_count: streamCount,
  request_count: requestCount,
  stream_prefix: streamPrefix,
  deterministic_stream_selection: deterministicStreamSelection,
  batch_size: batchSize,
  max_in_flight: maxInFlight,
  worker_count,
  size,
  connectionString,
  client,
}: Options) {
  const streams = Array.from({ length: streamCount }, (_, i) =>
    streamPrefix != null ? `${streamPrefix}-${i}` : uuid()
  );

  const data =
    "<ea{dr>fDO\x1Bt\x07u@g\x1Ce.V]3G\x1A\x01(h7oVOS\x18bNVuAp7\f\x10xp:cM\x16d\x12?\x7F'\x0F)O0A2$D9\tPVkFHY?_\"c\x17[\x11`\x17XVLP@SVZR2o\x13\x1E+!LL.H\x03`\x04jAW\x14d\"\r3\x14vG\x16b%bi>'j\x12yI0\tS(D6?DH:Wc&[\x19\x0B\b\x00Zo\x12,bv\x11X>VQ\x02&htwwzv\x16Br \x193X\x01C\x1D!G S[@~1%Y\x16pN!\x1Cxzx\x16P\x10!hM\x10v2h2<UfgBlj?l#h\x11A16YiG\x7F^\\\x07KKv\x1Dp\x15C\x12yc\fc_\\\x11B _(\r\x00m\x16H}\x1DR\x10'mm1`(w\b";
  // randomBytes(size).toString("ascii");
  const metadata =
    "<ea{dr>fDO\x1Bt\x07u@g\x1Ce.V]3G\x1A\x01(h7oVOS\x18bNVuAp7\f\x10xp:cM\x16d\x12?\x7F'\x0F)O0A2$D9\tPVkFHY?_\"c\x17[\x11`\x17XVLP@SVZR2o\x13\x1E+!LL.H\x03`\x04jAW\x14d\"\r3\x14vG\x16b%bi>'j\x12yI0\tS(D6?DH:Wc&[\x19\x0B\b\x00Zo\x12,bv\x11X>VQ\x02&htwwzv\x16Br \x193X\x01C\x1D!G S[@~1%Y\x16pN!\x1Cxzx\x16P\x10!hM\x10v2h2<UfgBlj?l#h\x11A16YiG\x7F^\\\x07KKv\x1Dp\x15C\x12yc\fc_\\\x11B _(\r\x00m\x16H}\x1DR\x10'mm1`(w\b";
  // randomBytes(size).toString("ascii");

  let k = 0;
  const nextStreamName = () => {
    let streamIndex = deterministicStreamSelection
      ? k++
      : Math.floor(Math.random() * streamCount);

    if (k >= streamCount) {
      k = 0;
    }

    return streams[streamIndex];
  };

  const workerCount = Math.min(clientCount, worker_count);

  const splitInteger = (num: number, parts: number) => {
    const mod = num % parts;
    const val = (num - mod) / parts;
    const result = Array(parts).fill(val);
    for (let i = 0; i < mod; i++) {
      result[i] += 1;
    }
    return result;
  };

  const workerCounts = splitInteger(clientCount, workerCount).map(
    (clientsForWorker) => ({
      count: Math.ceil(requestCount / clientCount),
      clientCount: clientsForWorker,
    })
  );

  let success = 0;
  let failure = 0;
  const failures = new Map<string, number>();

  const perfObserver = new PerformanceObserver((items) => {
    items.getEntries().forEach(({ duration }) => {
      const eventsSent = (success + failure) * batchSize;

      console.log(
        `DONE TOTAL ${eventsSent} WRITES IN ${duration}ms (${
          (1000.0 * eventsSent) / duration
        }/s)`
      );
      console.log(`SUCCESS: ${success} FAILURE: ${failure}`);

      if (failures.size) {
        console.log(
          `failures: \n${Array.from(failures)
            .map(([error, count]) => `${`${count}x`.padEnd(12, " ")}| ${error}`)
            .join("\n")}`
        );
      }
    });
  });

  perfObserver.observe({ entryTypes: ["measure"], buffered: true });

  performance.mark("writes-start");

  const promises = await Promise.allSettled(
    workerCounts.map(({ clientCount, count }, i) =>
      spawnWorker(
        {
          id: `${i}`,
          batchSize,
          clientCount,
          connectionString,
          count,
          data,
          metadata,
          deterministicStreamSelection,
          streams,
          maxInFlight,
          client,
        },
        nextStreamName
      )
    )
  );

  performance.mark("writes-end");

  for (const result of promises) {
    if (result.status === "fulfilled") {
      success += result.value.success;
      failure += result.value.failure;

      for (const [error, count] of result.value.failures) {
        const fail = error.toString();
        failures.set(fail, (failures.get(fail) ?? 0) + count);
      }
    } else {
      console.log("FAILURE: ", result.reason);
    }
  }

  // lazy way to get this last
  setTimeout(
    () => performance.measure("writes", "writes-start", "writes-end"),
    500
  );
}

function spawnWorker(
  options: Init,
  nextStreamName: () => string
): Promise<ResponseMsg> {
  return new Promise((resolve, reject) => {
    console.log(
      `spawning worker ${options.id} with ${options.clientCount} clients`,
      {
        ...options,
        streams: `[ ${options.streams[0]}, ...${
          options.streams.length - 1
        } more ]`,
      }
    );
    const worker = new Worker(require.resolve("./wrfl.worker"), {
      workerData: options,
      stdout: true,
    });
    worker.on("message", (msg: WToPMsg) => {
      switch (msg.type) {
        case "requestStream": {
          const reply: StreamMsg = {
            type: "requestStream",
            streamName: nextStreamName(),
          };
          worker.postMessage(reply);
          break;
        }
        case "finished": {
          resolve(msg);
          break;
        }
        case "perf": {
          console.log(msg.message);
          break;
        }
      }
    });
    worker.on("error", reject);
    worker.on("exit", (code) => {
      if (code !== 0)
        reject(new Error(`Worker stopped with exit code ${code}`));
    });
    worker.stdout.pipe(process.stdout);
  });
}

export default wrfl;
