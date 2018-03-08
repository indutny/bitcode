import * as assert from 'assert';
import { Buffer } from 'buffer';

import { Abbr, BitStream } from './bitstream';
import { BLOCK_ID, STRTAB_CODE } from './constants';

const STRTAB_ABBR_ID_WIDTH = 3;

export interface IStrtabEntry {
  buffer: Buffer;
  offset: number;
  length: number;
}

export class Strtab {
  private readonly list: IStrtabEntry[] = [];
  private readonly map: Map<string, IStrtabEntry> = new Map();
  private totalSize: number = 0;
  private isBuilt: boolean = false;

  public add(str: string): IStrtabEntry {
    assert(!this.isBuilt, 'Strtab was already built');

    if (this.map.has(str)) {
      return this.map.get(str)!;
    }

    const buffer = Buffer.from(str);

    const entry = {
      buffer,
      length: buffer.length,
      offset: this.totalSize,
    };

    this.totalSize += buffer.length;
    this.list.push(entry);
    this.map.set(str, entry);
    return entry;
  }

  public build(writer: BitStream): void {
    assert(!this.isBuilt, 'Strtab was already built');
    this.isBuilt = true;

    writer.enterBlock(BLOCK_ID.STRTAB, STRTAB_ABBR_ID_WIDTH);

    // TODO(indutny): can we do char6 here?
    if (this.list.length !== 0) {
      writer.defineAbbr(new Abbr('blob', [
        Abbr.literal(STRTAB_CODE.BLOB),
        Abbr.blob(),
      ]));
    }

    for (const entry of this.list) {
      writer.writeRecord('blob', [ entry.buffer ]);
    }

    writer.endBlock();
  }
}
