# ksql

`ksql` is a database that stores JS objects, with a synchronous `Map`-esque interface.

## Installing

`npm install ksql`

## API

```ts
// js
const {KSQL} = require('ksql');
// ts
import {KSQL} from 'ksql';
```

Create an instance with `new KSQL(name, opts)`.

`name` is the name of the database. This is required, and is used to load the DB from disk.

`opts` is optional, but has this type:

```ts
export interface DatabaseOptions {
    /** 
     * Set this to a number to tell the DB to cache an object in memory 
     * after it's been retrieved that number of times
     * */
    maxReferences?: number;
    /** Must be an absolute path */
    databaseDir?: string;
    memory?: boolean;
}
```

Write data into the database with `instance.set(key, value)`.
Both `key` and `value` can be anything serializable by v8 (basically anything outside of functions).

Read data with `instance.get(key)` (again, anything serializable).

Lastly, you can batch-read with `instance.entries(limit)` - which will return an array of [key, value] pairs. The `limit` param defaults to 100, and will return that many rows at once.

The current benchmark is 0.15ms on average for one read.