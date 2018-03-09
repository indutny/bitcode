import * as assert from 'assert';

import { BitWriter } from '../writers';
import { Abbr } from './abbr';
import { Block } from './block';
import { VBRValue } from './vbr-value';

const MAGIC = 0xdec04342;

const ROOT_ABBR_ID_WIDTH = 2;
const BLOCK_ID_WIDTH = 8;
const NEW_ABBR_ID_WIDTH_WIDTH = 4;
const CODE_WIDTH = 6;
const NUM_OPS_WIDTH = 6;
const OP_WIDTH = 6;

const END_BLOCK = 0;
const ENTER_SUBBLOCK = 1;
const DEFINE_ABBREV = 2;
const UNABBREV_RECORD = 3;

const BLOCKINFO = 0;
const SETBID = 1;

const DWORD_BITS = 32;
const DWORD_BYTES = 4;

interface IStackElem {
  block: Block;
  length: Buffer;
  offset: number;
}

export type BlockInfoMap = Map<number, Abbr[]>;

export class BitStream {
  private readonly writer: BitWriter = new BitWriter();
  private readonly stack: IStackElem[] = [];

  // block id => abbreviations
  private blockInfo: BlockInfoMap = new Map();

  constructor() {
    this.writeDWord(MAGIC);
  }

  public enterBlock(id: number, abbrIDWidth: number): BitStream {
    this.writeAbbrID(ENTER_SUBBLOCK);
    this.writeVBR(id, BLOCK_ID_WIDTH);
    this.writeVBR(abbrIDWidth, NEW_ABBR_ID_WIDTH_WIDTH);
    this.align(DWORD_BITS);

    const length = this.writer.reserve(DWORD_BITS);
    const offset = this.writer.offset;

    const globalAbbrs = this.blockInfo.get(id) || [];

    this.stack.push({
      block: new Block(id, abbrIDWidth, globalAbbrs),
      length,
      offset,
    });

    return this;
  }

  public endBlock(): BitStream {
    assert(this.stack.length > 0, 'No blocks to end');
    const elem = this.stack.pop() as IStackElem;

    this.writeAbbrID(END_BLOCK);
    this.align(DWORD_BITS);

    const computedLen = (this.writer.offset - elem.offset) / DWORD_BYTES;
    elem.length.writeUInt32LE(computedLen, 0);

    return this;
  }

  public writeBlockInfo(map: BlockInfoMap): BitStream {
    if (map.size === 0) {
      return this;
    }

    assert.strictEqual(this.blockInfo.size, 0,
      'BLOCKINFO can be written only once');

    map.forEach((abbrs, id) => {
      assert(typeof id === 'number', 'BLOCKINFO must have numeric block ids');
      this.blockInfo.set(id, abbrs);
    });

    this.enterBlock(BLOCKINFO, ROOT_ABBR_ID_WIDTH);

    map.forEach((abbrs, id) => {
      this.writeUnabbrRecord(SETBID, [ id ]);
      for (const abbr of abbrs) {
        this.defineAbbr(abbr);
      }
    });

    this.endBlock();

    return this;
  }

  public defineAbbr(abbr: Abbr): BitStream {
    assert(this.stack.length > 0, 'No blocks to define abbreviation in');

    this.writeAbbrID(DEFINE_ABBREV);
    abbr.writeDefinition(this);

    const block = this.stack[this.stack.length - 1].block;
    block.addAbbr(abbr);

    return this;
  }

  public hasAbbr(abbrName: string): boolean {
    assert(this.stack.length > 0, 'No blocks to define abbreviation in');

    const block = this.stack[this.stack.length - 1].block;
    return block.hasAbbr(abbrName);
  }

  public writeRecord(abbrName: string, values: ReadonlyArray<any>): BitStream {
    assert(this.stack.length > 0, 'No blocks to write abbreviation in');

    const block = this.stack[this.stack.length - 1].block;
    const entry = block.getAbbr(abbrName);
    if (entry === undefined) {
      throw new Error(`No abbreviation with name "${abbrName}" was found`);
    }

    this.writeAbbrID(entry.index);
    entry.abbr.write(this, values);

    return this;
  }

  public writeUnabbrRecord(code: number, values: ReadonlyArray<VBRValue>)
    : BitStream {
    this.writeAbbrID(UNABBREV_RECORD);
    this.writeVBR(code, CODE_WIDTH);
    this.writeVBR(values.length, NUM_OPS_WIDTH);
    for (const value of values) {
      this.writeVBR(value, OP_WIDTH);
    }

    return this;
  }

  public end(): Buffer {
    return this.writer.end();
  }

  public writeVBR(value: VBRValue, width: number): BitStream {
    assert(2 <= width && width <= 32, 'Invalid bit size of VBR field');
    if (Array.isArray(value)) {
      return this.writeVBR64(value[0], value[1], width);
    }

    let num = value as number;

    // TODO(indutny): implement me
    assert(value >= 0, 'Negative-valued VBR not implemented yet');

    const valueBits = width - 1;
    const mask = ((1 << valueBits) >> 0) - 1;
    const vbr = (1 << valueBits) >> 0;

    while (num > mask) {
      const left = num >>> valueBits;
      this.writeBits((vbr | (num & mask)), width);
      num = left;
    }

    this.writeBits(num, width);
    return this;
  }

  // Just a proxy

  public writeBits(value: number, width: number): BitStream {
    this.writer.writeBits(value, width);
    return this;
  }

  public writeByte(value: number): BitStream {
    this.writer.writeByte(value);
    return this;
  }

  public writeWord(value: number): BitStream {
    this.writer.writeWord(value);
    return this;
  }

  public writeDWord(value: number): BitStream {
    this.writer.writeDWord(value);
    return this;
  }

  public align(width: number): BitStream {
    this.writer.align(width);
    return this;
  }

  // Private

  private writeVBR64(hi: number, lo: number, width: number): BitStream {
    // Fast-case, 32bit value
    if (hi === 0) {
      return this.writeVBR(lo, width);
    }

    const valueBits = width - 1;
    const mask = ((1 << valueBits) >> 0) - 1;
    const vbr = (1 << valueBits) >> 0;

    while (hi !== 0) {
      const left = ((hi & mask) << (32 - valueBits)) | (lo >>> valueBits);
      if (left === 0) {
        break;
      }

      this.writeBits((vbr | (lo & mask)), width);
      lo = left;
      hi >>>= valueBits;
    }

    this.writeVBR(lo, width);
    return this;
  }

  private writeAbbrID(id: number): void {
    const stackLen = this.stack.length;
    const width = stackLen === 0 ? ROOT_ABBR_ID_WIDTH :
      this.stack[stackLen - 1].block.abbrIDWidth;

    assert(0 <= id && id < (1 << width), 'Abbreviation ID doesn\'t fit');
    this.writeBits(id, width);
  }
}
