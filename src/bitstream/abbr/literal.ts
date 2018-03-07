import { VBRValue } from '../vbr-value';
import { IWriter } from './abbr';
import { Operand } from './operand';

const LITERAL_WIDTH = 8;

export class Literal extends Operand {
  constructor(public readonly value: VBRValue) {
    super();
  }

  public encode(writer: IWriter, _?: any): void {
    writer.writeVBR(this.value, LITERAL_WIDTH);
  }
}
