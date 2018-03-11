import * as assert from 'assert';

import { Builder } from 'bitcode-builder';
import { Module } from '../src/bitcode';

describe('bitcode/compiler', () => {
  let m: Module;
  let b: Builder;
  beforeEach(() => {
    m = new Module('test.ll');
    b = m.createBuilder();
  });

  it('should compile a module', () => {
    const arrTy = b.array(4, b.i(32));
    const glob = b.global(arrTy.ptr(), 'some_global', arrTy.val([
      b.i(32).val(1),
      b.i(32).val(2),
      b.i(32).val(-2),
      b.i(32).val(-1),
    ]));

    glob.linkage = 'internal';
    glob.markConstant();
    glob.attrs.add([ { key: 'global', value: 'attribute' } ]);

    // Just an empty declaration
    const extra = b.signature(b.void(), [
      b.i(32), b.i(32),
    ]).declareFunction('extra');

    // Build a function
    const fn = b.signature(b.i(32), [ b.i(32), b.i(32) ]).defineFunction(
      'fn_name',
      [ 'param1', 'param2' ],
    );

    fn.attrs.add([ 'nounwind', 'noinline' ]);
    fn.paramAttrs[1].add([ { key: 'custom-stuff', value: 'what else' } ]);

    fn.body.name = 'start';

    // sum = param1 + param2
    const sum = fn.body.binop('add', fn.getArgument('param1'),
      fn.getArgument('param2'));

    // if (sum === 3)
    const bb1 = fn.createBlock('on_true');
    const bb2 = fn.createBlock('on_false');
    const cmp = fn.body.icmp('eq', sum, b.i(32).val(3));
    const branch = fn.body.branch(cmp, bb1, bb2);
    branch.metadata.set('prof', b.metadata([
      b.metadata('branch_weights'),
      b.metadata(b.i(32).val(2)),
      b.metadata(b.i(32).val(1)),
    ]));

    // false - unreachable
    bb2.unreachable();

    // true
    const cast = bb1.cast('zext', sum, b.i(64));
    const sum2 = bb1.binop('add', cast, b.i(64).val(123));
    const trunc = bb1.cast('trunc', sum2, b.i(32));

    const ptr = bb1.getelementptr(glob, b.i(32).val(0), b.i(32).val(1), true);
    const cell = bb1.load(ptr, 32, true);

    bb1.call(extra, [ trunc, cell ]);

    // create branch and phi
    const bb3 = fn.createBlock('left');
    const bb4 = fn.createBlock('right');
    const bb5 = fn.createBlock('join');
    const cmp2 = bb1.icmp('eq', cell, b.i(32).val(2));
    bb1.branch(cmp2, bb3, bb4);

    // left
    const left = bb3.binop('sub', trunc, b.i(32).val(3));
    bb3.jmp(bb5);

    // right
    const right = bb4.binop('mul', trunc, b.i(32).val(4));
    bb4.jmp(bb5);

    // join
    const phi = bb5.phi({ fromBlock: bb3, value: left });
    phi.addEdge({ fromBlock: bb4, value: right });

    // Create a structure
    const struct = b.struct('hello');
    struct.addField(b.i(32), 'a');
    struct.addField(b.i(32), 'b');
    struct.finalize();

    const i1 = bb5.insertvalue(struct.undef(), phi,
      struct.lookupField('a').index);
    const i2 = bb5.insertvalue(i1, phi, struct.lookupField('b').index);
    const i3 = bb5.extractvalue(i2, struct.lookupField('a').index);

    bb5.ret(i3);

    m.add(fn);
    assert.throws(() => m.add(fn), /clash/);

    // Adding the same declaration twice should have no effect
    m.add(extra);
    m.add(extra);

    // Same with globals
    m.add(glob);
    m.add(glob);

    const bc = m.build();

    // TODO(indutny): run `opt -S` and check the result
  });

  it('should compile a switch statement', () => {
    const i8 = b.i(8);

    // Build a function
    const fn = b.signature(i8, [ i8 ]).defineFunction('fn_name', [ 'p' ]);

    const otherwise = fn.createBlock('otherwise');
    const b0 = fn.createBlock('b0');
    const b1 = fn.createBlock('b1');
    const b2 = fn.createBlock('b2');

    fn.body.switch(fn.getArgument('p'), otherwise, [
      { value: i8.val(0), block: b0 },
      { value: i8.val(1), block: b1 },
      { value: i8.val(2), block: b2 },
    ]);

    otherwise.unreachable();
    b0.ret(i8.val(10));
    b1.ret(i8.val(20));
    b2.ret(i8.val(30));

    m.add(fn);

    const bc = m.build();
    require('fs').writeFileSync('/tmp/1.bc', bc);

    // TODO(indutny): run `opt -S` and check the result
  });
});
