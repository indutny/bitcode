'use strict';

const bitcode = require('./');
const constants = bitcode.constants;
const LLBitStream = bitcode.LLBitStream;

const BLOCK = constants.BLOCK;

const kWriteHeader = bitcode.symbols.kWriteHeader;

const MAGIC = 0xdec04342;

const MODULE_CODE_VERSION = 1;
const MODULE_CODE_VERSION_VALUE = 2;

const MODULE_BLOCK_ABBR_VBR = 6;

class Writer extends LLBitStream {
  constructor() {
    super();

    this.enterBlock(BLOCK.MODULE, MODULE_BLOCK_ABBR_VBR);
    this.writeUnabbrevRecord(MODULE_CODE_VERSION,
      [ MODULE_CODE_VERSION_VALUE ]);
  }

  [kWriteHeader]() {
    this.writeDWord(MAGIC);
  }

  end() {
    this.endBlock();
    super.end();
  }
}
module.exports = Writer;
