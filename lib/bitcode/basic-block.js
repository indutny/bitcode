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
  constructor(parent = null) {
    this.name = null;

    this[kSuccessors] = [];
    this[kPredecessors] = [];

    this[kInstructions] = [];
    this[kTerminator] = null;

    this[kParams] = parent ? parent[kParams] : new Map();
  }

  createChildBlock() {
    return new BasicBlock(this);
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
      res = this[kPush]('ret', [ value ], true);
    this[kTerminator] = res;

    return null;
  }

  jmp(to) {
    this[kSuccessors].push(to);
    to[kPredecessors].push(this);

    const res = this[kPush]('br', [ to ], true);
    this[kTerminator] = res;

    return null;
  }

  binop(subtype, left, right) {
    return this[kPush]('binop', [ subtype, left, right ]);
  }

  [kPush](type, operands = [], isVoid = false) {
    assert.strictEqual(this[kTerminator], null, 'Block already terminated');

    const inst = { type, operands, isVoid };
    this[kInstructions].push(inst);
    return inst;
  }
}
module.exports = BasicBlock;
