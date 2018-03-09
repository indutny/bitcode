import { BitStream } from '../bitstream';
import { Enumerator } from '../enumerator';
import { TypeTable } from '../type-table';

export abstract class Block {
  constructor(protected readonly enumerator: Enumerator,
              protected readonly typeTable: TypeTable) {
  }

  public abstract build(writer: BitStream): void;
}
