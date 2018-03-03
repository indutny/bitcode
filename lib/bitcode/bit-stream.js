'use strict';

const assert = require('assert');
const ByteStream = require('./').ByteStream;

const kDWord = Symbol('dWord');
const kLeft = Symbol('left');
const kOffset = Symbol('offset');

const WORD_BITS = 32;

class BitStream extends ByteStream {
  constructor() {
    super();

    // Current double word
    this[kDWord] = 0;

    // Bits left in current word
    this[kLeft] = WORD_BITS;

    // Bit offset in current word
    this[kOffset] = 0;
  }

  get bitOffset() {
    return this.offset * 8 + this[kOffset];
  }

  writeBits(val, bits) {
    if (bits === 0)
      return this;

    assert(0 < bits <= 32, 'Invalid number of bits');

    const fits = Math.min(this[kLeft], bits);
    let mask;
    if (fits === 32)
      mask = 0xffffffff;
    else
      mask = ((1 << fits) >>> 0) - 1;

    // Split on boundary
    if (fits < bits) {
      this.writeBits(val & mask, fits);
      this.writeBits(val >> fits, bits - fits);
      return this;
    }

    assert(0 <= val <= mask,
      'Invalid value, does not fit into specified bit size');
    this[kDWord] |= (val & mask) << this[kOffset];
    this[kOffset] += bits;
    this[kLeft] -= bits;

    // Flush word when it is full
    if (this[kLeft] === 0) {
      super.writeDWord(this[kDWord] >>> 0);
      this[kDWord] = 0;
      this[kOffset] = 0;
      this[kLeft] = WORD_BITS;
    }

    return this;
  }

  writeByte(val) {
    return this.writeBits(val, 8);
  }

  writeWord(val) {
    return this.writeBits(val, 16);
  }

  writeDWord(val) {
    return this.writeBits(val, 32);
  }

  pad(size) {
    this.writeBits(0, size);
  }

  end() {
    // Flush remaining data
    if (this[kLeft] !== WORD_BITS) {
      this.pad(this[kLeft] % 8);
      if (this[kLeft] === 0) {
        super.writeDWord(this[kDWord]);
      } else if (this[kLeft] === 8) {
        super.writeByte(this[kDWord] & 0xff);
        super.writeWord(this[kDWord] >> 8);
      } else if (this[kLeft] === 16) {
        super.writeWord(this[kDWord]);
      } else if (this[kLeft] === 24) {
        super.writeByte(this[kDWord]);
      }
      this[kLeft] = WORD_BITS;
      this[kOffset] = 0;
    }

    super.end();
  }
}
module.exports = BitStream;
