'use strict';

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
}
module.exports = LLBitStream;
