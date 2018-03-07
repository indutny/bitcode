import { BitWriter } from '../writers';
import { Block } from './block';

export class BitStream {
  private readonly writer: BitWriter = new BitWriter();
  private readonly stack: Block[] = [];
}
