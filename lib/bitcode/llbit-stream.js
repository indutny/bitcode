'use strict';

const assert = require('assert');

const bitcode = require('./');
const BitStream = bitcode.BitStream;

const kWriteHeader = bitcode.symbols.kWriteHeader;
const kBlockInfo = Symbol('blockInfo');
const kStack = Symbol('stack');

const END_BLOCK = 0;
const ENTER_SUBBLOCK = 1;
const DEFINE_ABBREV = 2;
const UNABBREV_RECORD = 3;

const ROOT_ABBR_VBR = 2;
const BLOCK_ID_VBR = 8;
const NEW_ABBR_LEN_VBR = 4;
const UNABBREV_RECORD_CODE_VBR = 6;
const UNABBREV_RECORD_NUM_OPS_VBR = 6;
const UNABBREV_RECORD_OP_VBR = 6;
const DEFINE_RECORD_NUM_OPS_VBR = 5;
const DEFINE_RECORD_LIT_VALUE_VBR = 8;
const DEFINE_RECORD_ENCODING_VBR = 3;
const DEFINE_RECORD_VALUE_VBR = 5;
const ARRAY_LEN_VBR = 6;

const ENCODING_FIXED = 1;
const ENCODING_VBR = 2;
const ENCODING_ARRAY = 3;
const ENCODING_CHAR6 = 4;
const ENCODING_BLOB = 5;

const FIRST_USER_ABBREV_ID = 4;

const BLOCK_INFO_ID = 0;

class Block {
  constructor(id, abbrVBR, reservedLen, parent = null) {
    this.id = id;

    this.parent = parent;
    this.abbrVBR = abbrVBR;
    this.reservedLen = reservedLen;

    if (parent)
      this.abbreviations = parent.abbreviations.slice();
    else
      this.abbreviations = [];
  }

  addAbbr(item) {
    this.abbreviations.push(item);
  }

  getNextAbbrId() {
    return FIRST_USER_ABBREV_ID + this.abbreviations.length;
  }
}

class LLBitStream extends BitStream {
  constructor() {
    super();

    // Stack of blocks
    this[kStack] = [ new Block(ROOT_ABBR_VBR, null) ];

    // Map of default abbreviations per block id
    this[kBlockInfo] = new Map();

    this[kWriteHeader]();
  }

  [kWriteHeader]() {
    // To-be overridden
  }

  writeVBR(val, bits) {
    if (Array.isArray(val))
      return this.writeVBR64(val[0], val[1], bits);

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

  writeChar6(ch) {
    assert.strictEqual(ch.length, 1, 'Expected single character');
    let code = ch.charCodeAt(0);

    // 'a' - 'z'
    if (0x61 <= code && code <= 0x7a) {
      code = code - 0x61;

    // 'A' - 'Z'
    } else if (0x41 <= code && code <= 0x5a) {
      code = code - 0x41 + 26;
    // '0' - '9'
    } else if (0x30 <= code && code <= 0x39) {
      code = code - 0x30 + 52;
    // '.'
    } else if (code === 0x2e) {
      code = 62;
    // '_'
    } else if (code === 0x5f) {
      code = 63;
    } else {
      throw new Error('Invalid char6: ' + ch);
    }

    this.writeBits(code, 6);
  }

  writeAbbrId(id) {
    const blocks = this[kStack];

    this.writeVBR(id, blocks[blocks.length - 1].abbrVBR);
  }

  enterBlock(id, newAbbrVBR) {
    this.writeAbbrId(ENTER_SUBBLOCK);
    this.writeVBR(id, BLOCK_ID_VBR);
    this.writeVBR(newAbbrVBR, NEW_ABBR_LEN_VBR);
    this.align(32);

    const reservedLen = this.reserveDWord();

    const stack = this[kStack];
    const parent = stack[stack.length - 1];
    const res = new Block(id, newAbbrVBR, reservedLen, parent);

    // Add default abbr from BLOCKINFO
    if (this[kBlockInfo].has(id))
      this[kBlockInfo].forEach(abbr => res.addAbbr(abbr));

    stack.push(res);
  }

  endBlock() {
    const blocks = this[kStack];

    assert.strictNotEqual(blocks.length, 1, 'No blocks to end');

    this.writeAbbrId(END_BLOCK);
    this.align(32);
    this[kStack].pop();
  }

  writeUnabbrevRecord(code, ops = []) {
    assert(Array.isArray(ops), 'Invalid `ops` argument');

    this.writeAbbrId(UNABBREV_RECORD);
    this.writeVBR(code, UNABBREV_RECORD_CODE_VBR);
    this.writeVBR(ops.length, UNABBREV_RECORD_NUM_OPS_VBR);

    ops.forEach((op) => {
      this.writeVBR(op, UNABBREV_RECORD_OP_VBR);
    });
  }

  defineAbbr(ops) {
    const stack = this[kStack];
    const current = stack[stack.length - 1];

    const id = current.getNextAbbrId();

    this.writeAbbr(DEFINE_ABBREV);
    this.writeVBR(ops.length, DEFINE_RECORD_NUM_OPS_VBR);

    const emitOp = (op) => {
      this.writeBits(1, 0);
      if (op.type === 'fixed') {
        this.writeVBR(ENCODING_FIXED, DEFINE_RECORD_ENCODING_VBR);
        this.writeVBR(op.width, DEFINE_RECORD_VALUE_VBR);
      } else if (op.type === 'vbr') {
        this.writeVBR(ENCODING_VBR, DEFINE_RECORD_ENCODING_VBR);
        this.writeVBR(op.width, DEFINE_RECORD_VALUE_VBR);
      } else if (op.type === 'array') {
        this.writeVBR(ENCODING_ARRAY, DEFINE_RECORD_ENCODING_VBR);
        emitOp(op.valueOp);
      } else if (op.type === 'char6') {
        this.writeVBR(ENCODING_CHAR6, DEFINE_RECORD_ENCODING_VBR);
      } else if (op.type === 'blob') {
        this.writeVBR(ENCODING_BLOB, DEFINE_RECORD_ENCODING_VBR);
      } else {
        throw new Error('Unexpected operand type: ' + op.type);
      }
    };

    ops.forEach((op) => {
      if (op.type === 'literal') {
        this.writeBits(1, 1);
        this.writeVBR(op.value, DEFINE_RECORD_LIT_VALUE_VBR);
        return;
      }

      emitOp(op);
    });

    current.addAbbr({ id, ops });
    return id;
  }

  writeAbbr(id, code, values) {
    const stack = this[kStack];
    const current = stack[stack.length - 1];

    assert(id >= FIRST_USER_ABBREV_ID, 'Invalid abbreviation id');
    id -= FIRST_USER_ABBREV_ID;

    assert(id < current.abbreviations.length, 'Unknown abbreviation id');
    const abbr = current.abbreviations[id];

    this.writeAbbrId(id);

    const encodeOp = (op, value) => {
      if (op.type === 'fixed') {
        this.writeBits(value, op.width);
      } else if (op.type === 'vbr') {
        this.writeVBR(value, op.width);
      } else if (op.type === 'array') {
        assert(Array.isArray(value));

        this.writeVBR(value.length, ARRAY_LEN_VBR);
        value.forEach(elem => encodeOp(op.valueOp, elem));
      } else if (op.type === 'char6') {
        this.writeChar6(value);
      }
    };

    let i = 0;
    abbr.ops.forEach((op) => {
      // Part of encoding, skip
      if (op.type === 'literal')
        return;

      assert(i < values.length, 'Not enough values');
      const value = values[i++];
      encodeOp(op, value);
    });
  }
}
module.exports = LLBitStream;
