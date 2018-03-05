'use strict';

const assert = require('assert');

const bitcode = require('./');
const constants = bitcode.constants;

const kInstructions = bitcode.symbols.kInstructions;
const kSuccessors = bitcode.symbols.kSuccessors;

const BLOCK = constants.BLOCK;
const RECORD = constants.RECORD;
const LINKAGE = constants.LINKAGE;
const CCONV = constants.CCONV;

const FUNCTION_ABBR_WIDTH = 4;

class FunctionTable {
  constructor(strtab) {
    this.strtab = strtab;

    this.fns = [];
  }

  declare(name, type, info) {
    const entry = Object.assign({
      cconv: 'ccc',
      body: null,
      linkage: 'internal',
      attributes: null,
      align: false,
      unnamed: false
    }, info, {
      type,
      name: this.strtab.add(name)
    });

    this.fns.push(entry);
  }

  // TODO(indutny): make this private
  serializeInstr(instr, table, stream) {
    if (instr.type === 'ret') {
      // TODO(indutny): support argument
      assert.strictEqual(instr.operands.length, 0, 'Implement me');
      stream.writeUnabbrevRecord(RECORD.FUNCTION_INST_RET, []);
    } else {
      throw new Error('Unknown instruction type: ' + instr.type);
    }
  }

  // TODO(indutny): make this private
  serializeFn(start, stream) {
    // Enumerate all reachable blocks first
    const blocks = {
      map: new Map(),
      list: []
    };

    const queue = [ start ];
    while (queue.length !== 0) {
      const block = queue.shift();
      if (blocks.map.has(block))
        continue;

      blocks.map.set(block, blocks.size + 1);
      blocks.list.push(block);

      block[kSuccessors].forEach(succ => queue.push(succ));
    }

    // TODO(indutny): abbreviate all of this in BlockInfo
    stream.writeUnabbrevRecord(RECORD.FUNCTION_DECLAREBLOCKS,
      [ blocks.list.length ]);

    const instructions = new Map();

    // Enumerate all instructions
    blocks.list.forEach((block) => {
      block[kInstructions].forEach((instr) => {
        assert(!instructions.has(instr), 'Duplicate instruction');
        instructions.set(instr, instructions.size + 1);
      });
    });

    blocks.list.forEach((block) => {
      block[kInstructions].forEach((instr) => {
        this.serializeInstr(instr, {
          instructions,
          blocks
        }, stream);
      });
    });
  }

  serializeTo(stream) {
    let hasBodies = false;

    this.fns.forEach((entry) => {
      if (entry.body !== null)
        hasBodies = true;

      assert(LINKAGE.hasOwnProperty(entry.linkage),
        'Unknown linkage: ' + entry.linkage);
      const linkage = LINKAGE[entry.linkage];

      assert(CCONV.hasOwnProperty(entry.cconv),
        'Unknown calling convention: ' + entry.cconv);
      const cconv = CCONV[entry.cconv];

      // TODO(indutny): use `defineAbbr`
      stream.writeUnabbrevRecord(RECORD.FUNCTION, [
        entry.name.offset,
        entry.name.size,

        entry.type,
        cconv,
        entry.body === null ? 1 : 0,  // is_declaration
        linkage,
        entry.attributes === null ? 0 : entry.attributes,
        entry.align === false ? 0 : (entry.align + 1),

        // TODO(indutny): support this
        0,  // section
        0,  // visibility
        0,  // has gc

        entry.unnamed === false ? 0 : entry.unnamed === 'local' ? 2 : 1,

        // TODO(indutny): support this
        0,  // prologue data
        0,  // dllstorageclass
        0,  // comdat
        0,  // prefix data
        0,  // personality

        // dso_local
        (entry.linkage === 'private' || entry.linkage === 'internal') ? 1 : 0
      ]);
    });

    if (!hasBodies)
      return;

    stream.enterBlock(BLOCK.FUNCTION, FUNCTION_ABBR_WIDTH);
    this.fns.forEach((entry) => {
      if (entry.body !== null)
        this.serializeFn(entry.body, stream);
    });
    stream.endBlock();
  }
}
module.exports = FunctionTable;
