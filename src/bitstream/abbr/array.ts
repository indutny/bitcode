import * as assert from 'assert';

import { IWriter } from './abbr';
import { Blob } from './blob';
import { Literal } from './literal';
import { Operand } from './operand';

const LENGTH_WIDTH = 6;

class ArrayOp extends Operand {
  constructor(public readonly elemOp: Operand) {
    super();

    const isDisallowed = elemOp instanceof Literal ||
      elemOp instanceof Blob ||
      elemOp instanceof ArrayOp;
    assert(!isDisallowed, 'Array elements can\'t be literals/arrays/blobs');
  }

  public encode(writer: IWriter, value?: any): void {
    assert(Array.isArray(value) || typeof value === 'string',
      'Array encoding expected Array or string argument');
    const arrValue: string | any[] = value as any;

    writer.writeVBR(arrValue.length, LENGTH_WIDTH);
    for (const elem of arrValue) {
      this.elemOp.encode(writer, elem);
    }
  }
}

export { ArrayOp as Array };
