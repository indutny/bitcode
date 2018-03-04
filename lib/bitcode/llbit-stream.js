'use strict';

const assert = require('assert');

const bitcode = require('./');
const BitStream = bitcode.BitStream;

const kWriteHeader = bitcode.symbols.kWriteHeader;

class LLBitStream extends BitStream {
  constructor() {
    super();

    this[kWriteHeader]();
  }

  [kWriteHeader]() {
    // To-be overridden
  }

  writeVBR(val, bits) {
    assert(0 <= val && val <= 0xffffffff, 'Invalid value of VBR field');
    assert(2 <= bits && bits <= 32, 'Invalid bit size of VBR field');
    const valueBits = bits - 1;

    const mask = ((1 << valueBits) >>> 0) - 1;

    const vbr = (1 << valueBits) >>> 0;

    while (val !== 0) {
      const left = val >>> valueBits;
      if (left === 0)
        break;

      this.writeBits((vbr | (val & mask)), bits);
      val = left;
    }

    assert.strictEqual(val & mask, val);
    this.writeBits(val, bits);
  }

  writeVBR64(hi, lo, bits) {
    // Fast-case, 32bit value
    if (hi === 0)
      return this.writeVBR(lo, bits);

    assert(0 <= hi && hi <= 0xffffffff, 'Invalid value of VBR field');
    assert(0 <= lo && lo <= 0xffffffff, 'Invalid value of VBR field');

    assert(2 <= bits && bits <= 32, 'Invalid bit size of VBR field');
    const valueBits = bits - 1;

    const mask = ((1 << valueBits) >>> 0) - 1;
    const vbr = (1 << valueBits) >>> 0;

    const pad = (s) => {
      while (s.length < 32)
        s = '0' + s;
      return s;
    };

    while (hi !== 0) {
      const left = ((((hi & mask) << (32 - valueBits)) >>> 0) |
        (lo >>> valueBits)) >>> 0;
      if (left === 0)
        break;

      this.writeBits((vbr | (lo & mask)), bits);
      lo = left;
      hi >>>= valueBits;
    }

    this.writeVBR(lo, bits);
  }
}
module.exports = LLBitStream;
