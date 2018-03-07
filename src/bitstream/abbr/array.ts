import * as assert from 'assert';

import { IWriter } from './abbr';
import { Literal } from './literal';
import { Operand } from './operand';

const LENGTH_WIDTH = 6;

class ArrayOp extends Operand {
  constructor(public readonly elemType: Operand) {
    super();

    assert(!(elemType instanceof Literal), 'Array elements can\'t be literals');
  }

  public encode(writer: IWriter, value?: any): void {
    assert(Array.isArray(value) || typeof value === 'string',
      'Array encoding expected Array or string argument');
    const arrValue: string | any[] = value as any;

    writer.writeVBR(arrValue.length, LENGTH_WIDTH);
    for (const elem of arrValue) {
      this.elemType.encode(writer, elem);
    }
  }
}

export { ArrayOp as Array };
