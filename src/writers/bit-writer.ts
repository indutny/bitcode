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

  public writeBits(value: number, bits: number): BitWriter {
    if (bits === 0) {
      return this;
    }

    assert(0 < bits && bits <= DWORD_BITS, 'Invalid number of bits');

    const fits = Math.min(this.dwordLeft, bits);
    let mask;
    if (fits === 32) {
      mask = 0xffffffff;
    } else {
      mask = ((1 << fits) >> 0) - 1;
    }

    // Split on boundary
    if (fits < bits) {
      this.writeBits(value & mask, fits);
      this.writeBits(value >> fits, bits - fits);
      return this;
    }

    this.dword |= (value & mask) << this.dwordOff;
    this.dwordOff += bits;
    this.dwordLeft -= bits;

    // Flush word when it is full
    if (this.dwordLeft === 0) {
      this.writer.writeDWord(this.dword);
      this.dword = 0;
      this.dwordOff = 0;
      this.dwordLeft = DWORD_BITS;
    }

    return this;
  }

  public writeByte(val: number): BitWriter {
    return this.writeBits(val, BYTE_BITS);
  }

  public writeWord(val: number): BitWriter {
    return this.writeBits(val, WORD_BITS);
  }

  public writeDWord(val: number): BitWriter {
    return this.writeBits(val, DWORD_BITS);
  }

  public pad(size: number): BitWriter {
    return this.writeBits(0, size);
  }

  public align(size: number): BitWriter {
    return this.pad(this.dwordLeft % size);
  }

  public reserve(bytes: number): Buffer {
    assert.strictEqual(this.dwordOff % BYTE_BITS, 0,
      'Must be aligned before reservation');
    this.flush();

    return this.writer.reserve(bytes);
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
      this.writer.writeWord(this.dword >> 8);
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
