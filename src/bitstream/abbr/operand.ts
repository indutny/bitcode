import { IWriter } from './abbr';

export abstract class Operand {
  public abstract encode(writer: IWriter, value?: any): void;
}
