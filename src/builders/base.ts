import { BitStream, BlockInfoMap } from '../bitstream';
import { Enumerator } from '../enumerator';
import { TypeTable } from '../type-table';

export abstract class Builder {
  constructor(protected readonly enumerator: Enumerator,
              protected readonly typeTable: TypeTable) {
  }

  public abstract buildInfo(info: BlockInfoMap): void;
}
