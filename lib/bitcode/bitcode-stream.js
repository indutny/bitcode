'use strict';

const bitcode = require('./');
const constants = bitcode.constants;
const LLBitStream = bitcode.LLBitStream;

const BLOCK = constants.BLOCK;
const RECORD = constants.RECORD;

const MODULE_CODE_VERSION_VALUE = 2;
const MODULE_BLOCK_ABBR_VBR = 6;

const kWriteHeader = bitcode.symbols.kWriteHeader;

class BitcodeStream extends LLBitStream {
  constructor() {
    super();

    this.strtab = new bitcode.Strtab();
    this.typeTable = new bitcode.TypeTable();
    this.globals = new bitcode.Globals(this.strtab);
  }

  [kWriteHeader]() {
    this.writeDWord(constants.MAGIC);
  }

  end() {
    this.enterBlock(BLOCK.MODULE, MODULE_BLOCK_ABBR_VBR);
    this.writeUnabbrevRecord(RECORD.MODULE_CODE_VERSION,
      [ MODULE_CODE_VERSION_VALUE ]);

    this.typeTable.serializeTo(this);
    this.globals.serializeTo(this);

    this.endBlock();

    this.strtab.serializeTo(this);
    super.end();
  }
}
module.exports = BitcodeStream;
