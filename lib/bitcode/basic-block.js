'use strict';

const assert = require('assert');

const bitcode = require('./');

const kInstructions = bitcode.symbols.kInstructions;
const kSuccessors = bitcode.symbols.kSuccessors;
const kPredecessors = Symbol('predecessors');
const kTerminator = Symbol('terminator');
const kPush = Symbol('push');

class BasicBlock {
  constructor() {
    this[kSuccessors] = [];
    this[kPredecessors] = [];

    this[kInstructions] = [];
    this[kTerminator] = null;
  }

  ret(type = null, value = null) {
    let res;
    if (type === null)
      res = this[kPush]('ret');
    else
      res = this[kPush]('ret', [ type, value ]);
    this[kTerminator] = res;
  }

  [kPush](type, operands = []) {
    assert.strictEqual(this[kTerminator], null, 'Block already terminated');

    const inst = { type, operands };
    this[kInstructions].push(inst);
    return inst;
  }
}
module.exports = BasicBlock;
