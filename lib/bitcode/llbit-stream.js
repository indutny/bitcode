'use strict';

const assert = require('assert');
const Buffer = require('buffer').Buffer;

const bitcode = require('./');
const constants = bitcode.constants;
const BitStream = bitcode.BitStream;
const ABBR = constants.ABBR;
const BLOCK = constants.BLOCK;

const kWriteHeader = bitcode.symbols.kWriteHeader;
const kBlockInfo = Symbol('blockInfo');
const kStack = Symbol('stack');
const kOnRecord = Symbol('onRecord');

const ROOT_ABBR_WIDTH = 2;
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
const BLOB_LEN_VBR = 6;

const ENCODING_FIXED = 1;
const ENCODING_VBR = 2;
const ENCODING_ARRAY = 3;
const ENCODING_CHAR6 = 4;
const ENCODING_BLOB = 5;

const FIRST_USER_ABBREV_ID = 4;

const BLOCKINFO_SETBID = 1;
const BLOCKINFO_BLOCKNAME = 2;
const BLOCKINFO_SETRECORDNAME = 3;

class Block {
  constructor(id, abbrWidth, reservedLen, info = null, parent = null) {
    this.id = id;

    this.parent = parent;
    this.info = info;
    this.abbrWidth = abbrWidth;
    this.reservedLen = reservedLen;

    if (this.parent)
      this.abbreviations = this.parent.abbreviations.slice();
    else
      this.abbreviations = [];

    // Add abbreviations from BLOCKINFO
    if (this.info)
      this.abbreviations = this.abbreviations.concat(this.info.abbreviations);
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
    this[kStack] = [ new Block(null, ROOT_ABBR_WIDTH, null) ];

    // Map of default abbreviations per block id
    this[kBlockInfo] = {
      map: new Map(),
      current: null
    };

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

    while (val > mask) {
      const left = val >>> valueBits;
      this.writeBits((vbr | (val & mask)), bits);
      val = left;
    }

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

    this.writeBits(id, blocks[blocks.length - 1].abbrWidth);
  }

  enterBlock(id, newAbbrWidth = null) {
    const stack = this[kStack];
    const parent = stack[stack.length - 1];

    if (!newAbbrWidth)
      newAbbrWidth = parent.abbrWidth;

    this.writeAbbrId(ABBR.ENTER_SUBBLOCK);
    this.writeVBR(id, BLOCK_ID_VBR);
    this.writeVBR(newAbbrWidth, NEW_ABBR_LEN_VBR);
    this.align(32);

    const reservedLen = this.reserveDWord();
    const offset = this.offset;

    // Add default abbr from BLOCKINFO
    let info = null;
    if (this[kBlockInfo].map.has(id))
      info = this[kBlockInfo].map.get(id);

    const res = new Block(id, newAbbrWidth, {
      offset,
      reservation: reservedLen
    }, info, parent);

    stack.push(res);
  }

  endBlock() {
    const blocks = this[kStack];

    assert.notStrictEqual(blocks.length, 1, 'No blocks to end');

    this.writeAbbrId(ABBR.END_BLOCK);
    this.align(32);

    // Resolve block length
    const offset = this.offset;
    const last = this[kStack].pop();
    const len = offset - last.reservedLen.offset;

    this.resolveDWord(last.reservedLen.reservation, len / 4);
  }

  writeUnabbrevRecord(code, ops = []) {
    assert(Array.isArray(ops), 'Invalid `ops` argument');

    this.writeAbbrId(ABBR.UNABBREV_RECORD);
    this.writeVBR(code, UNABBREV_RECORD_CODE_VBR);
    this.writeVBR(ops.length, UNABBREV_RECORD_NUM_OPS_VBR);

    ops.forEach((op) => {
      this.writeVBR(op, UNABBREV_RECORD_OP_VBR);
    });

    this[kOnRecord](code, ops);
  }

  defineAbbr(ops) {
    const stack = this[kStack];
    const current = stack[stack.length - 1];

    const id = current.getNextAbbrId();

    this.writeAbbrId(ABBR.DEFINE_ABBREV);
    this.writeVBR(ops.length, DEFINE_RECORD_NUM_OPS_VBR);

    const emitOp = (op) => {
      this.writeBits(0, 1);
      if (op.type === 'fixed') {
        this.writeBits(ENCODING_FIXED, DEFINE_RECORD_ENCODING_VBR);
        this.writeVBR(op.width, DEFINE_RECORD_VALUE_VBR);
      } else if (op.type === 'vbr') {
        this.writeBits(ENCODING_VBR, DEFINE_RECORD_ENCODING_VBR);
        this.writeVBR(op.width, DEFINE_RECORD_VALUE_VBR);
      } else if (op.type === 'array') {
        // TODO(indutny): Check that this is the last op
        this.writeBits(ENCODING_ARRAY, DEFINE_RECORD_ENCODING_VBR);
        emitOp(op.of);
      } else if (op.type === 'char6') {
        this.writeBits(ENCODING_CHAR6, DEFINE_RECORD_ENCODING_VBR);
      } else if (op.type === 'blob') {
        // TODO(indutny): Check that this is the last op
        this.writeBits(ENCODING_BLOB, DEFINE_RECORD_ENCODING_VBR);
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

    const abbr = { id, ops };

    if (current.id === BLOCK.INFO) {
      const blockInfo = this[kBlockInfo];
      assert.notStrictEqual(blockInfo.current, null,
        'SETBID must be a first record in BLOCKINFO');

      blockInfo.map.get(blockInfo.current).abbreviations.push(abbr);
    }

    current.addAbbr(abbr);
    return id;
  }

  writeRecord(id, values) {
    const stack = this[kStack];
    const current = stack[stack.length - 1];

    assert(id >= FIRST_USER_ABBREV_ID, 'Invalid abbreviation id');

    const index = id - FIRST_USER_ABBREV_ID;
    assert(index < current.abbreviations.length, 'Unknown abbreviation id');
    const abbr = current.abbreviations[index];

    this.writeAbbrId(id);

    const encodeOp = (op, value) => {
      if (op.type === 'fixed') {
        this.writeBits(value, op.width);
      } else if (op.type === 'vbr') {
        this.writeVBR(value, op.width);
      } else if (op.type === 'array' && op.of.type === 'char6') {
        assert(typeof value === 'string' ||
               Array.isArray(value), 'Expected array or string value');
        // Just a convenience for `char6` array (strings)
        this.writeVBR(value.length, ARRAY_LEN_VBR);
        for (let i = 0; i < value.length; i++)
          encodeOp(op.of, value[i]);
      } else if (op.type === 'array') {
        assert(Array.isArray(value), 'Expected array value');

        this.writeVBR(value.length, ARRAY_LEN_VBR);
        value.forEach(elem => encodeOp(op.of, elem));
      } else if (op.type === 'char6') {
        this.writeChar6(value);
      } else if (op.type === 'blob') {
        assert(Buffer.isBuffer(value), 'Expected Buffer value');
        this.writeVBR(value.length, BLOB_LEN_VBR);
        this.align(32);

        // TODO(indutny): optimize this
        for (let i = 0; i < value.length; i++)
          this.writeByte(value[i]);

        this.align(32);
      }
    };

    const recordOps = [];

    let i = 0;
    abbr.ops.forEach((op) => {
      // Part of encoding, skip
      if (op.type === 'literal') {
        recordOps.push(op.value);
        return;
      }

      assert(i < values.length, 'Not enough values');
      const value = values[i++];
      recordOps.push(value);
      encodeOp(op, value);
    });

    this[kOnRecord](recordOps.shift(), recordOps);
  }

  // Internal

  [kOnRecord](code, ops) {
    const stack = this[kStack];
    const current = stack[stack.length - 1];
    if (current.id !== BLOCK.INFO)
      return;

    const blockInfo = this[kBlockInfo];

    if (code === BLOCKINFO_SETBID) {
      assert.strictEqual(ops.length, 1);
      assert.strictEqual(typeof ops[0], 'number');

      blockInfo.current = ops[0];
      if (blockInfo.has(ops[0]))
        blockInfo.map.set(ops[0], { abbreviations: [] });
      return;
    }

    if (code === BLOCKINFO_BLOCKNAME) {
      // Just skip
      return;
    }

    if (code === BLOCKINFO_SETRECORDNAME) {
      // Just skip
      return;
    }
  }
}
module.exports = LLBitStream;
