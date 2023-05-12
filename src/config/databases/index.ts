/*
 * https://github.com/morethanwords/tweb
 * Copyright (C) 2019-2021 Eduard Kuzmenko
 * https://github.com/morethanwords/tweb/blob/master/LICENSE
 */

import {IDBStore} from '../../lib/files/idb';

export type DatabaseStore<StoreName extends string> = Omit<IDBStore, 'name'> & {name: StoreName};
export type Database<StoreName extends string> = {
  name: string,
  version: number,
  stores: DatabaseStore<StoreName>[]
};
