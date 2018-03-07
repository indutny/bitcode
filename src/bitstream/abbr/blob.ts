import * as assert from 'assert';
import { Buffer } from 'buffer';

import { IWriter } from './abbr';
import { Operand } from './operand';

const LEN_WIDTH = 6;
const BYTE_WIDTH = 8;
const DWORD_WIDTH = 32;

export class Blob extends Operand {
  constructor() {
    super();
  }

  public encode(writer: IWriter, value?: any): void {
    assert(Buffer.isBuffer(value), 'Blob expected Buffer value');

    const buf = value as Buffer;
    writer.writeVBR(buf.length, LEN_WIDTH);
    writer.align(DWORD_WIDTH);

    // TODO(indutny): optimize
    for (const ch of buf) {
      writer.writeBits(ch, BYTE_WIDTH);
    }
    writer.align(DWORD_WIDTH);
  }
}
