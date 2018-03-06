'use strict';

const assert = require('assert');
const Buffer = require('buffer').Buffer;

const bitcode = require('./');
const constants = bitcode.constants;

const kInstructions = bitcode.symbols.kInstructions;
const kSuccessors = bitcode.symbols.kSuccessors;

const BLOCK = constants.BLOCK;
const RECORD = constants.RECORD;
const LINKAGE = constants.LINKAGE;
const CCONV = constants.CCONV;

const FUNCTION_ABBR_WIDTH = 4;
const FUNCTION_SYMTAB_ABBR_WIDTH = 4;

class FunctionTable {
  constructor(strtab, types) {
    this.strtab = strtab;
    this.types = types;

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

  getInstrOffset(table, from, to) {
    assert(table.instructions.has(from), 'Unknown from value: ' + from.type);
    assert(table.instructions.has(to), 'Unknown to value: ' + to.type);

    return table.instructions.get(from) - table.instructions.get(to);
  }

  getBlockID(table, block) {
    assert(table.blocks.map.has(block), 'Unknown block');
    return table.blocks.map.get(block);
  }

  // TODO(indutny): make this private
  // TODO(indutny): Implement these instructions:
  // icmp, extractvalue, or, and, icmp, getelementptr, call, sext, zext, trunc,
  // store, load, bitcast, phi, lshr, mul, ptrtoint, sub, insertvalue, br,
  // switch
  serializeInstr(instr, table, stream) {
    if (instr.type === 'ret') {
      const ops = [];
      if (instr.operands.length !== 0)
        ops.push(this.getInstrOffset(table, instr, instr.operands[0]));

      stream.writeUnabbrevRecord(RECORD.FUNCTION_INST_RET, ops);
    } else if (instr.type === 'binop') {
      const ops = [];
      if (instr.operands.length !== 0)
        ops.push(this.getInstrOffset(table, instr, instr.operands[0]));

      stream.writeUnabbrevRecord(RECORD.FUNCTION_INST_BINOP, ops);
    } else if (instr.type === 'br') {
      stream.writeUnabbrevRecord(RECORD.FUNCTION_INST_BR, [
        this.getBlockID(table, instr.operands[0])
      ]);
    } else {
      throw new Error('Unknown instruction type: ' + instr.type);
    }
  }

  serializeFn(fn, stream) {
    const body = fn.body;
    const signature = this.types.lookup(fn.type);

    // Enumerate all reachable blocks first
    const blocks = {
      map: new Map(),
      list: []
    };

    const queue = [ body ];
    while (queue.length !== 0) {
      const block = queue.shift();
      if (blocks.map.has(block))
        continue;

      blocks.map.set(block, blocks.map.size);
      blocks.list.push(block);

      block[kSuccessors].forEach(succ => queue.push(succ));
    }

    // TODO(indutny): abbreviate all of this in BlockInfo
    stream.writeUnabbrevRecord(RECORD.FUNCTION_DECLAREBLOCKS,
      [ blocks.list.length ]);

    const instructions = new Map();

    // Enumerate all params
    signature.params.forEach((_, i) => {
      instructions.set(body.param(i), instructions.size);
    });

    // Enumerate all instructions
    blocks.list.forEach((block) => {
      block[kInstructions].forEach((instr) => {
        assert(!instructions.has(instr), 'Duplicate instruction');
        instructions.set(instr, instructions.size);
      });
    });

    const table = { instructions, blocks };
    blocks.list.forEach((block) => {
      block[kInstructions].forEach((instr) => {
        this.serializeInstr(instr, table, stream);
      });
    });

    stream.enterBlock(BLOCK.VALUE_SYMTAB, FUNCTION_SYMTAB_ABBR_WIDTH);

    // Serialize parameter names
    if (fn.paramNames) {
      fn.paramNames.forEach((name, index) => {
        if (name === null)
          return;

        assert(instructions.has(body.param(index)),
          'Unexpected parameter #' + index);

        // TODO(indutny): abbreviate
        const ops = [ instructions.get(body.param(index)) + 1 ];
        name = Array.from(Buffer.from(name));
        stream.writeUnabbrevRecord(RECORD.SYMTAB_ENTRY, ops.concat(name));
      });
    }

    // Serialize block names
    blocks.list.forEach((block, index) => {
      if (block.name === null)
        return;

      // TODO(indutny): abbreviate
      const ops = [ index ];
      const name = Array.from(Buffer.from(block.name));

      stream.writeUnabbrevRecord(RECORD.SYMTAB_BBENTRY, ops.concat(name));
    });
    stream.endBlock();
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
        this.serializeFn(entry, stream);
    });
    stream.endBlock();
  }
}
module.exports = FunctionTable;
