import * as assert from 'assert';

import { VBRValue } from '../vbr-value';
import { IWriter } from './abbr';
import { Operand } from './operand';

export class VBR extends Operand {
  constructor(public readonly width: number) {
    super();
  }

  public encode(writer: IWriter, value?: any): void {
    // TODO(indutny): How to check that the type is VBRValue?
    assert(typeof value === 'number' || Array.isArray(value),
      'Fixed encoding expected VBR number value');

    writer.writeVBR(value as VBRValue, this.width);
  }
}
