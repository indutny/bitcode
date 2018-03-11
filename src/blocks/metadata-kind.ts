import * as assert from 'assert';
import { Buffer } from 'buffer';

import { Abbr, BitStream, BlockInfoMap } from '../bitstream';
import { BLOCK_ID, METADATA_KIND_CODE, VBR } from '../constants';
import { Block } from './base';

const METADATA_KIND_ABBR_ID_WIDTH = 3;

export class MetadataKindBlock extends Block {
  constructor(private readonly map: ReadonlyMap<string, number>) {
    super();
  }

  public build(writer: BitStream): void {
    super.build(writer);

    // No metadata to write
    if (this.map.size === 0) {
      return;
    }

    writer.enterBlock(BLOCK_ID.METADATA_KIND, METADATA_KIND_ABBR_ID_WIDTH);
    writer.defineAbbr(new Abbr('kind', [
      Abbr.literal(METADATA_KIND_CODE.KIND),
      Abbr.vbr(VBR.METADATA_KIND_INDEX),
      Abbr.blob(),
    ]));

    for (const [ key, value ] of this.map) {
      const buf = Buffer.from(key);
      writer.writeRecord('kind', [ value, buf ]);
    }
    writer.endBlock(BLOCK_ID.METADATA_KIND);
  }
}
