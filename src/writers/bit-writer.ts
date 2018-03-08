import * as assert from 'assert';
import { Buffer } from 'buffer';

import { ByteWriter } from './byte-writer';

const BYTE_BITS = 8;
const WORD_BITS = 16;
const DWORD_BITS = 32;

export class BitWriter {
  private readonly writer: ByteWriter = new ByteWriter();

  // Current double word
  private dword: number = 0;

  // Bits left in current word
  private dwordLeft: number = DWORD_BITS;

  // Bit offset in current word
  private dwordOff: number = 0;

  public get offset() { return this.writer.offset; }

  public get bitOffset() {
    return this.offset * BYTE_BITS + this.dwordOff;
  }

  public writeBits(value: number, width: number): BitWriter {
    if (width === 0) {
      return this;
    }

    assert(0 < width && width <= DWORD_BITS, 'Invalid number of bits');

    const fits = Math.min(this.dwordLeft, width);
    let mask;
    if (fits === 32) {
      mask = 0xffffffff;
    } else {
      mask = ((1 << fits) >>> 0) - 1;
    }

    // Split on boundary
    if (fits < width) {
      this.writeBits(value & mask, fits);
      this.writeBits(value >>> fits, width - fits);
      return this;
    }

    this.dword |= (value & mask) << this.dwordOff;
    this.dwordOff += width;
    this.dwordLeft -= width;

    // Flush word when it is full
    if (this.dwordLeft === 0) {
      this.writer.writeDWord(this.dword);
      this.dword = 0;
      this.dwordOff = 0;
      this.dwordLeft = DWORD_BITS;
    }

    return this;
  }

  public writeByte(value: number): BitWriter {
    return this.writeBits(value, BYTE_BITS);
  }

  public writeWord(value: number): BitWriter {
    return this.writeBits(value, WORD_BITS);
  }

  public writeDWord(value: number): BitWriter {
    return this.writeBits(value, DWORD_BITS);
  }

  public pad(width: number): BitWriter {
    return this.writeBits(0, width);
  }

  public align(width: number): BitWriter {
    return this.pad(this.dwordLeft % width);
  }

  public reserve(width: number): Buffer {
    assert.strictEqual(width % BYTE_BITS, 0,
      'Only bytes can be reserved');
    assert.strictEqual(this.dwordOff % BYTE_BITS, 0,
      'Must be aligned before reservation');
    this.flush();

    return this.writer.reserve(width / BYTE_BITS);
  }

  public end(): Buffer {
    this.flush();
    return this.writer.end();
  }

  private flush(): void {
    // Flush remaining data
    if (this.dwordOff === 0) {
      return;
    }

    this.align(BYTE_BITS);
    if (this.dwordOff === BYTE_BITS + WORD_BITS) {
      this.writer.writeByte(this.dword & 0xff);
      this.writer.writeWord(this.dword >>> 8);
    } else if (this.dwordOff === WORD_BITS) {
      this.writer.writeWord(this.dword);
    } else if (this.dwordOff === BYTE_BITS) {
      this.writer.writeByte(this.dword);
    } else {
      assert.strictEqual(this.dwordOff, 0);
    }

    this.dwordLeft = DWORD_BITS;
    this.dwordOff = 0;
  }
}
