import { values } from 'bitcode-builder';
import { Abbr, BitStream, BlockInfoMap } from '../bitstream';
import { BLOCK_ID } from '../constants';
import { Block } from './base';

import Metadata = values.constants.Metadata;

export class MetadataBlock extends Block {
  public static buildInfo(info: BlockInfoMap): void {
    // no-op
  }

  public build(writer: BitStream): void {
    super.build(writer);
  }
}
