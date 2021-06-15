# Test Client Node

## Getting started

Make sure you have node >= 12 installed

### Install dependancies:

```
yarn
```

### Build

```
yarn build
```

### Run

```
yarn start <command>
```

## Global Options:

|                         | description                   | type    | required | default |
| ----------------------- | ----------------------------- | ------- | -------- | ------- |
| --help                  | Show help                     | boolean |          |         |
| --version               | Show Version Number           | boolean |          |         |
| --connection-string     | Connection string for server  | string  | yes      |         |

## Commands

### wrfl

Multi Write Processor across workers

#### Example:

```
yarn start wrfl --connection-string "esdb://c0e0d3arh41g7drr2ilg.mesdb.eventstore.cloud:2113" --client_count=1 --request_count=200
```

#### Options:

|                                  | description                                       | type            | required | default       |
| -------------------------------- | ------------------------------------------------- | --------------- | -------- | ------------- |
| --client                         | Client to use                                     | `gpb` or `pbjs` | yes      | `gpb`         |
| --client_count                   | Number of clients to use                          | number          | yes      |               |
| --request_count                  | Number of requests to make in total               | number          | yes      |               |
| --stream_count                   | Number of streams to write to                     | number          |          | 1000          |
| --size                           | The size of the event data and metadata           | number          |          | 256           |
| --batch_size                     | Number of events per request                      | number          |          | 1             |
| --stream_prefix                  | prefix stream names                               | string          |          |               |
| --deterministic_stream_selection | Write to streams sequentually                     | boolean         |          | false         |
| --worker_count                   | number of workers to use                          | number          |          | cpu count - 1 |
| --max_in_flight                  | Maximum number of requests in flight (Per client) | number          |          | Infinity      |

### rdfl

Multi Read Processor across workers

#### Example:

```
yarn start rdfl --connection-string "esdb://c0e0d3arh41g7drr2ilg.mesdb.eventstore.cloud:2113" --client_count=1 --request_count=200
```

#### Options:

|                                  | description                                       | type    | required | default       |
| -------------------------------- | ------------------------------------------------- | ------- | -------- | ------------- |
| --client_count                   | Number of clients to use                          | number  | yes      |               |
| --request_count                  | Number of requests to make in total               | number  | yes      |               |
| --stream_count                   | Number of streams to read from                    | number  |          | 1000          |
| --batch_size                     | Number of events per read                         | number  |          | 1             |
| --stream_prefix                  | prefix stream names                               | string  |          |               |
| --deterministic_stream_selection | Write to streams sequentually                     | boolean |          | false         |
| --worker_count                   | number of workers to use                          | number  |          | cpu count - 1 |
| --max_in_flight                  | Maximum number of requests in flight (Per client) | number  |          | Infinity      |

### safl

Multi Read Processor from subscription across workers

#### Example:

```
yarn start safl --connection-string "esdb://c0e0d3arh41g7drr2ilg.mesdb.eventstore.cloud:2113" --client_count=1 --total_events_to_read=200
```

#### Options:

|                               | description                                      | type                 | required | default       |
| ----------------------------- | ------------------------------------------------ | -------------------- | -------- | ------------- |
| --client_count                | Number of clients to use                         | number               | yes      |               |
| --worker_count                | Number of workers to use                         | number               |          | cpu count - 1 |
| --total_events_to_read        | Total number of events to read from subscription | number               |          | 1000          |
| --report_per_number_of_events | Report progress per number of events             | number               |          | 1000          |
| --from_position               | Start of subscription                            | `'start'` or `'end'` |          | `'start'`     |
| --resolve_link_tos            | Resolve link tos                                 | boolean              |          | false         |
