import * as assert from 'assert';

import { BitStream } from '../bitstream';

export abstract class Block {
  private isBuilt: boolean = false;

  public build(writer: BitStream): void {
    this.checkNotBuilt();
    this.isBuilt = true;
  }

  protected checkBuilt(): void {
    assert(this.isBuilt, 'Block wasn\'t built yet');
  }

  protected checkNotBuilt(): void {
    assert(!this.isBuilt, 'Block already built');
  }
}
