import * as assert from 'assert';

import { IWriter } from './abbr';
import { Operand } from './operand';

export class Fixed extends Operand {
  constructor(public readonly width: number) {
    super();
  }

  public encode(writer: IWriter, value?: any): void {
    assert(typeof value === 'number', 'Fixed encoding expected number');

    writer.writeBits(value as number, this.width);
  }
}
