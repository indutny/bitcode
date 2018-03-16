import * as assert from 'assert';
import { Buffer } from 'buffer';

import { values } from 'bitcode-builder';
import { Abbr, BitStream, BlockInfoMap } from '../bitstream';
import { BLOCK_ID, METADATA_CODE, VBR } from '../constants';
import { Enumerator } from '../enumerator';
import { Block } from './base';
import { TypeBlock } from './type';

import Constant = values.constants.Constant;
import Metadata = values.constants.Metadata;

const METADATA_ABBR_ID_WIDTH = 3;
const LEN_WRITER_VBR = 6;
const DWORD_BITS = 32;

interface IMetadataString {
  readonly type: 'string';
  readonly index: number;
}

interface IMetadataTuple {
  readonly type: 'tuple';
  readonly operands: ReadonlyArray<Metadata>;
  readonly index: number;
}

interface IMetadataValue {
  readonly type: 'value';
  readonly value: Constant;
  readonly index: number;
}

type MetadataEntry = IMetadataString | IMetadataTuple | IMetadataValue;

export class MetadataBlock extends Block {
  public static buildInfo(info: BlockInfoMap): void {
    info.set(BLOCK_ID.METADATA, [
      new Abbr('strings', [
        Abbr.literal(METADATA_CODE.STRINGS),
        Abbr.vbr(VBR.METADATA_STRING_COUNT),
        Abbr.vbr(VBR.METADATA_STRING_OFF),
        Abbr.blob(),
      ]),
      new Abbr('tuple', [
        Abbr.literal(METADATA_CODE.NODE),
        Abbr.array(Abbr.vbr(VBR.METADATA_INDEX)),
      ]),
      new Abbr('value', [
        Abbr.literal(METADATA_CODE.VALUE),
        Abbr.vbr(VBR.TYPE_INDEX),
        Abbr.vbr(VBR.VALUE_INDEX),
      ]),
    ]);
  }

  private readonly map: Map<Metadata, MetadataEntry> = new Map();
  private readonly strings: Map<string, number> = new Map();
  private readonly values: IMetadataValue[] = [];
  private readonly tuples: IMetadataTuple[] = [];

  constructor(private readonly enumerator: Enumerator,
              private readonly typeBlock: TypeBlock,
              list: ReadonlyArray<Metadata>) {
    super();
    list.forEach((metadata) => this.add(metadata));
  }

  public get(metadata: Metadata): number {
    this.checkBuilt();

    assert(this.map.has(metadata), 'Unknown metadata');
    const entry = this.map.get(metadata)!;

    // Strings come first
    if (entry.type === 'string') {
      return entry.index;
    }

    // Values after strings
    if (entry.type === 'value') {
      return this.strings.size + entry.index;
    }

    // Time for tuples
    assert.strictEqual(entry.type, 'tuple');
    return this.strings.size + this.values.length + entry.index;
  }

  public build(writer: BitStream): void {
    super.build(writer);

    // No metadata to write
    if (this.strings.size === 0 && this.values.length === 0 &&
        this.tuples.length === 0) {
      return;
    }

    writer.enterBlock(BLOCK_ID.METADATA, METADATA_ABBR_ID_WIDTH);
    this.buildStrings(writer);
    this.buildValues(writer);
    this.buildTuples(writer);
    writer.endBlock(BLOCK_ID.METADATA);
  }

  // Private methods

  private add(metadata: Metadata): void {
    this.checkNotBuilt();

    if (this.map.has(metadata)) {
      return;
    }

    let res;
    if (typeof metadata.value === 'string') {
      res = this.addString(metadata.value);
    } else if (Array.isArray(metadata.value)) {
      res = this.addTuple(metadata.value);
    } else {
      res = this.addValue(metadata.value as Constant);
    }
    this.map.set(metadata, res);
  }

  private addString(value: string): IMetadataString {
    if (this.strings.has(value)) {
      return { type: 'string', index: this.strings.get(value)! };
    }

    const index = this.strings.size;
    this.strings.set(value, index);
    return { type: 'string', index };
  }

  private addTuple(operands: ReadonlyArray<Metadata>): IMetadataTuple {
    operands.forEach((meta) => this.add(meta));
    const res: IMetadataTuple = {
      index: this.tuples.length,
      operands,
      type: 'tuple',
    };
    this.tuples.push(res);
    return res;
  }

  private addValue(value: Constant): IMetadataValue {
    const res: IMetadataValue = {
      index: this.values.length,
      type: 'value',
      value,
    };
    this.values.push(res);
    return res;
  }

  private buildStrings(writer: BitStream): void {
    const bufs: Buffer[] = [];
    let total: number = 0;

    const lenWriter = new BitStream();
    for (const str of this.strings.keys()) {
      const buf = Buffer.from(str);

      bufs.push(buf);
      lenWriter.writeVBR(buf.length, LEN_WRITER_VBR);
      total += buf.length;
    }
    lenWriter.align(DWORD_BITS);

    const lens = lenWriter.end();
    bufs.unshift(lens);
    total += lens.length;

    const blob = Buffer.concat(bufs, total);

    writer.writeRecord('strings', [
      this.strings.size,
      lens.length,
      blob,
    ]);
  }

  private buildValues(writer: BitStream): void {
    for (const value of this.values) {
      let ty = value.value.ty;

      // Store pointers to functions
      if (ty.isSignature()) {
        ty = ty.ptr();
      }
      writer.writeRecord('value', [
        this.typeBlock.get(ty),
        this.enumerator.get(value.value),
      ]);
    }
  }

  private buildTuples(writer: BitStream): void {
    for (const tuple of this.tuples) {
      writer.writeRecord('tuple', [
        tuple.operands.map((operand) => 1 + this.get(operand)),
      ]);
    }
  }
}
