import { VBRValue } from '../vbr-value';
import { IWriter } from './abbr';
import { Operand } from './operand';

export class Literal extends Operand {
  constructor(public readonly value: VBRValue) {
    super();
  }

  public encode(writer: IWriter, _?: any): void {
    throw new Error('Literals must not be encoded');
  }
}
