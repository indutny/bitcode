import * as assert from 'assert';

import { VBRValue } from '../vbr-value';
import { operands as ops } from './';
import { Operand } from './operand';

const IS_LITERAL_WIDTH = 1;
const LITERAL_VALUE_WIDTH = 8;
const ENC_WIDTH = 3;
const VALUE_WIDTH = 5;

const LITERAL = 1;
const NOT_LITERAL = 0;

const FIXED_ENC = 1;
const VBR_ENC = 2;
const ARRAY_ENC = 3;
const CHAR6_ENC = 4;
const BLOB_ENC = 5;

export interface IWriter {
  writeVBR(val: VBRValue, encWidth: number): IWriter;
  writeBits(val: number, bits: number): IWriter;
  align(bits: number): IWriter;
}

export class Abbr {
  constructor(public readonly name: string,
              public readonly operands: ReadonlyArray<Operand>) {
  }

  public writeDefinition(writer: IWriter): void {
    this.operands.forEach((operand) => {
      if (operand instanceof ops.Literal) {
        writer.writeBits(LITERAL, IS_LITERAL_WIDTH);
        writer.writeVBR(operand.value, LITERAL_VALUE_WIDTH);
        return;
      }

      writer.writeBits(NOT_LITERAL, IS_LITERAL_WIDTH);
      if (operand instanceof ops.Fixed) {
        writer.writeBits(FIXED_ENC, ENC_WIDTH);
        writer.writeVBR(operand.width, VALUE_WIDTH);
      } else if (operand instanceof ops.VBR) {
        writer.writeBits(VBR_ENC, ENC_WIDTH);
        writer.writeVBR(operand.width, VALUE_WIDTH);
      } else if (operand instanceof ops.Array) {
        writer.writeBits(ARRAY_ENC, ENC_WIDTH);
      } else if (operand instanceof ops.Char6) {
        writer.writeBits(CHAR6_ENC, ENC_WIDTH);
      } else if (operand instanceof ops.Blob) {
        writer.writeBits(BLOB_ENC, ENC_WIDTH);
      }
    });
  }

  public write(writer: IWriter, values: ReadonlyArray<any>): void {
    let i = 0;

    this.operands.forEach((operand) => {
      if (operand instanceof ops.Literal) {
        operand.encode(writer);
        return;
      }

      assert(i < values.length, '`encode()` wasn\'t give enough values');
      operand.encode(writer, values[i++]);
    });

    assert.strictEqual(i, values.length,
      '`encode()` was given more values than encoded');
  }
}
