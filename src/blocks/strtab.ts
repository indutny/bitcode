import { Buffer } from 'buffer';

import { Abbr, BitStream } from '../bitstream';
import { BLOCK_ID, STRTAB_CODE } from '../constants';
import { Block } from './base';

const STRTAB_ABBR_ID_WIDTH = 3;

export interface IStrtabEntry {
  buffer: Buffer;
  offset: number;
  length: number;
}

export class StrtabBlock extends Block {
  private readonly list: IStrtabEntry[] = [];
  private readonly map: Map<string, IStrtabEntry> = new Map();
  private totalSize: number = 0;

  public add(str: string): IStrtabEntry {
    this.checkNotBuilt();

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
    super.build(writer);

    if (this.list.length === 0) {
      return;
    }

    writer.enterBlock(BLOCK_ID.STRTAB, STRTAB_ABBR_ID_WIDTH);

    // TODO(indutny): can we do char6 here?
    writer.defineAbbr(new Abbr('blob', [
      Abbr.literal(STRTAB_CODE.BLOB),
      Abbr.blob(),
    ]));

    writer.writeRecord('blob', [
      Buffer.concat(this.list.map((e) => e.buffer), this.totalSize),
    ]);

    writer.endBlock(BLOCK_ID.STRTAB);
  }
}
