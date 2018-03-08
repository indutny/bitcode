import * as assert from 'assert';

import { VBRValue } from '../vbr-value';
import { Array as ArrayOp } from './array';
import { Blob } from './blob';
import { Char6 } from './char6';
import { Fixed } from './fixed';
import { Literal } from './literal';
import { Operand } from './operand';
import { VBR } from './vbr';

const IS_LITERAL_WIDTH = 1;
const LITERAL_VALUE_WIDTH = 8;
const ENC_WIDTH = 3;
const VALUE_WIDTH = 5;
const OPERAND_COUNT_WIDTH = 5;

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
  // Convenience methods

  public static literal(value: number): Literal {
    return new Literal(value);
  }

  public static fixed(width: number): Fixed {
    return new Fixed(width);
  }

  public static vbr(width: number): VBR {
    return new VBR(width);
  }

  public static array(elemOp: Operand): ArrayOp {
    return new ArrayOp(elemOp);
  }

  public static char6(): Char6 {
    return new Char6();
  }

  public static blob(): Blob {
    return new Blob();
  }

  // Flat operand count
  private readonly operandCount: number;

  constructor(public readonly name: string,
              public readonly operands: ReadonlyArray<Operand>) {
    // TODO(indutny): check that Blob and Array are the last operands
    // (if present)
    let count = 0;
    function countOperand(operand: Operand) {
      count++;
      if (operand instanceof ArrayOp) {
        countOperand(operand.elemOp);
      }
    }
    operands.forEach(countOperand);
    this.operandCount = count;
  }

  // Internal APIs

  public writeDefinition(writer: IWriter): void {
    writer.writeVBR(this.operandCount, OPERAND_COUNT_WIDTH);
    this.operands.forEach(function defineOperand(operand) {
      if (operand instanceof Literal) {
        writer.writeBits(LITERAL, IS_LITERAL_WIDTH);
        writer.writeVBR(operand.value, LITERAL_VALUE_WIDTH);
        return;
      }

      writer.writeBits(NOT_LITERAL, IS_LITERAL_WIDTH);
      if (operand instanceof Fixed) {
        writer.writeBits(FIXED_ENC, ENC_WIDTH);
        writer.writeVBR(operand.width, VALUE_WIDTH);
      } else if (operand instanceof VBR) {
        writer.writeBits(VBR_ENC, ENC_WIDTH);
        writer.writeVBR(operand.width, VALUE_WIDTH);
      } else if (operand instanceof ArrayOp) {
        writer.writeBits(ARRAY_ENC, ENC_WIDTH);
        defineOperand(operand.elemOp);
      } else if (operand instanceof Char6) {
        writer.writeBits(CHAR6_ENC, ENC_WIDTH);
      } else if (operand instanceof Blob) {
        writer.writeBits(BLOB_ENC, ENC_WIDTH);
      }
    });
  }

  public write(writer: IWriter, values: ReadonlyArray<any>): void {
    let i = 0;

    this.operands.forEach((operand) => {
      // Implicit
      if (operand instanceof Literal) {
        return;
      }

      assert(i < values.length, '`encode()` wasn\'t give enough values');
      operand.encode(writer, values[i++]);
    });

    assert.strictEqual(i, values.length,
      '`encode()` was given more values than encoded');
  }
}
