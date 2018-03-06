'use strict';

const bitcode = require('./');
const constants = bitcode.constants;
const LLBitStream = bitcode.LLBitStream;

const BLOCK = constants.BLOCK;
const RECORD = constants.RECORD;

const VERSION_VALUE = 2;
const MODULE_BLOCK_ABBR_VBR = 6;

const kWriteHeader = bitcode.symbols.kWriteHeader;

class BitcodeStream extends LLBitStream {
  constructor() {
    super();

    this.strtab = new bitcode.Strtab();
    this.types = new bitcode.TypeTable();
    this.globals = new bitcode.Globals(this.strtab);
    this.attributes = new bitcode.ParamAttrTable();
    this.functions = new bitcode.FunctionTable(this.strtab, this.types);
  }

  [kWriteHeader]() {
    this.writeDWord(constants.MAGIC);
  }

  createBasicBlock() {
    return new bitcode.BasicBlock();
  }

  end() {
    this.enterBlock(BLOCK.MODULE, MODULE_BLOCK_ABBR_VBR);
    this.writeUnabbrevRecord(RECORD.VERSION, [ VERSION_VALUE ]);

    this.attributes.serializeTo(this);
    this.types.serializeTo(this);
    this.globals.serializeTo(this);
    this.functions.serializeTo(this);

    this.endBlock();

    this.strtab.serializeTo(this);

    super.end();
  }
}
module.exports = BitcodeStream;
