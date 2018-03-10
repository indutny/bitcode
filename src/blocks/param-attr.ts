import { values } from 'bitcode-builder';
import { Buffer } from 'buffer';

import { Abbr, BitStream } from '../bitstream';
import { BLOCK_ID } from '../constants';
import { Block } from './base';

import constants = values.constants;

export class ParamAttrBlock extends Block {
  public add(decl: constants.Declaration): void {
    this.checkNotBuilt();
  }

  public build(writer: BitStream): void {
    super.build(writer);
  }
}
