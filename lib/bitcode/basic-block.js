'use strict';

const assert = require('assert');

const bitcode = require('./');

const kInstructions = bitcode.symbols.kInstructions;
const kSuccessors = bitcode.symbols.kSuccessors;
const kParams = Symbol('params');
const kPredecessors = Symbol('predecessors');
const kTerminator = Symbol('terminator');
const kPush = Symbol('push');

class BasicBlock {
  constructor() {
    this.name = null;

    this[kSuccessors] = [];
    this[kPredecessors] = [];

    this[kInstructions] = [];
    this[kTerminator] = null;

    // TODO(indutny): merge params from the parent block
    this[kParams] = new Map();
  }

  param(index) {
    if (this[kParams].has(index))
      return this[kParams].get(index);

    const res = { type: 'param', index };
    this[kParams].set(index, res);
    return res;
  }

  ret(value = null) {
    let res;

    // TODO(indutny): verify type?
    if (value === null)
      res = this[kPush]('ret');
    else
      res = this[kPush]('ret', [ value ]);
    this[kTerminator] = res;
  }

  jmp(to) {
    this[kSuccessors].push(to);
    to[kPredecessors].push(this);

    const res = this[kPush]('br', [ to ]);
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
