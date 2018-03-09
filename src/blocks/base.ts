import { BitStream } from '../bitstream';

export abstract class Block {
  public abstract build(writer: BitStream): void;
}
