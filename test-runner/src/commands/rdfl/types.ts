export interface Init {
  id: string;
  clientCount: number;
  connectionString: string;
  batchSize: number;
  count: number;
  deterministicStreamSelection: boolean;
  streams: string[];
  maxInFlight: number;
}

export interface ResponseMsg {
  type: "finished";
  success: number;
  failure: number;
  failures: Array<[string, number]>;
}

export interface PerformanceMsg {
  type: "perf";
  message: string;
}

export interface RequestStreamMsg {
  type: "requestStream";
}

export interface StreamMsg {
  type: "requestStream";
  streamName: string;
}

export type PToWMsg = StreamMsg;
export type WToPMsg = ResponseMsg | RequestStreamMsg | PerformanceMsg;
