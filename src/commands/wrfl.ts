import { jsonEvent } from "@eventstore/db-client";

import { v4 as uuid } from "uuid";
import type { CommandModule } from "yargs";

import { performance, PerformanceObserver } from "perf_hooks";
import { createClientCreator } from "../utils/createClientCreator";

interface Options {
  connectionString: string;
  rootCertificatePath?: string;
  certChainPath?: string;
  privateKeyPath?: string;
  client_count: number;
  request_count: number;
  stream_count: number;
  size: number;
  batch_size: number;
  deterministic_stream_names: boolean;
  deterministic_stream_selection: boolean;
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
    deterministic_stream_names: {
      type: "boolean",
      default: false,
    },
    deterministic_stream_selection: {
      type: "boolean",
      default: false,
    },
  },
  handler,
};

async function handler({
  client_count: clientCount,
  stream_count: streamCount,
  request_count: requestCount,
  deterministic_stream_names: deterministicStreamNames,
  deterministic_stream_selection: deterministicStreamSelection,
  batch_size: batchSize,
  size,

  connectionString,
  rootCertificatePath,
  certChainPath,
  privateKeyPath,
}: Options) {
  const createClient = await createClientCreator({
    connectionString,
    rootCertificatePath,
    certChainPath,
    privateKeyPath,
  });

  const streams = Array.from({ length: streamCount }, (_, i) =>
    deterministicStreamNames
      ? `${i}.00000000-0000-0000-0000-000000000000`
      : uuid()
  );
  const data = "*".repeat(size);
  const metadata = "$".repeat(size);

  let success = 0;
  let failure = 0;
  let total = 0;
  const failures = new Map<string, number>();

  const perfObserver = new PerformanceObserver((items) => {
    items.getEntries().forEach(({ duration }) => {
      const eventsSent = requestCount * batchSize;

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

  let resolve: () => void;
  const overall = new Promise<void>((r) => (resolve = r));
  const completed = () => {
    if (total >= requestCount) {
      resolve();
    }
  };

  for (let n = 0; n < clientCount; n++) {
    runClient(n);
  }

  await overall;

  performance.mark("writes-end");
  performance.measure("writes", "writes-start", "writes-end");

  function runClient(clientNum: number) {
    const client = createClient();

    let k = Math.floor((streamCount / clientCount) * clientNum);
    const count =
      requestCount / clientCount +
      (clientNum === clientCount - 1 ? requestCount % clientCount : 0);

    if (deterministicStreamNames) {
      process.stdout.write(
        `Writer ${clientNum} writing ${count} writes starting at stream ${k} \n`
      );
    }

    for (let n = 0; n < count; n++) {
      const events = createEventBatch("TakeSomeSpaceEvent", batchSize);
      let streamIndex = deterministicStreamSelection
        ? k++
        : Math.floor(Math.random() * streamCount);
      if (k >= streamCount) {
        k = 0;
      }
      client
        .appendToStream(streams[streamIndex], events)
        .then(() => success++)
        .catch((e) => {
          failure++;
          const fail = e.toString();
          failures.set(fail, (failures.get(fail) ?? 0) + 1);
        })
        .finally(() => {
          total++;
          completed();
        });
    }
  }

  function createEventBatch(type: string, size: number) {
    return Array.from({ length: size }, () =>
      jsonEvent({
        type,
        data,
        metadata,
      })
    );
  }
}

export default wrfl;
