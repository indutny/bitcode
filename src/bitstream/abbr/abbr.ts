import * as assert from 'assert';

import { VBRValue } from '../vbr-value';
import { Literal } from './literal';
import { Operand } from './operand';

const IS_LITERAL_WIDTH = 1;
const LITERAL = 1;
const NOT_LITERAL = 0;

export interface IWriter {
  writeVBR(val: VBRValue, encWidth: number): IWriter;
  writeBits(val: number, bits: number): IWriter;
  align(bits: number): IWriter;
}

export class Abbr {
  constructor(public readonly name: string,
              public readonly operands: ReadonlyArray<Operand>) {
  }

  public encode(writer: IWriter, values: ReadonlyArray<any>) {
    let i = 0;

    this.operands.forEach((operand) => {
      if (operand instanceof Literal) {
        writer.writeBits(LITERAL, IS_LITERAL_WIDTH);
        operand.encode(writer);
        return;
      }

      writer.writeBits(NOT_LITERAL, IS_LITERAL_WIDTH);

      assert(i < values.length, '`encode()` wasn\'t give enough values');
      operand.encode(writer, values[i++]);
    });

    assert.strictEqual(i, values.length,
      '`encode()` was given more values than encoded');
  }
}
