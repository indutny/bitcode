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
    const extra = b.signature(b.void(), [ b.i(32) ]).declareFunction('extra');

    const fn = b.signature(b.i(32), [ b.i(32), b.i(32) ]).defineFunction(
      'fn_name',
      [ 'param1', 'param2' ],
    );
    fn.body.name = 'start';

    const sum = fn.body.binop('add', fn.getArgument('param1'),
      fn.getArgument('param2'));

    const bb1 = fn.createBlock('on_true');
    const bb2 = fn.createBlock('on_false');
    const cmp = fn.body.icmp('eq', sum, b.i(32).val(3));
    fn.body.branch(cmp, bb1, bb2);

    const cast = bb1.cast('zext', sum, b.i(64));
    const sum2 = bb1.binop('add', cast, b.i(64).val(123));
    const trunc = bb1.cast('trunc', sum2, b.i(32));
    bb1.call(extra, [ trunc ]);
    bb1.ret(trunc);

    bb2.unreachable();

    const arrTy = b.array(4, b.i(32));
    const glob = b.global(arrTy.ptr(), 'some_global', arrTy.val([
      b.i(32).val(1),
      b.i(32).val(2),
      b.i(32).val(-2),
      b.i(32).val(-1),
    ]));

    glob.linkage = 'internal';
    glob.markConstant();

    m.add(fn);
    m.add(extra);
    m.add(glob);

    const bc = m.build();
    require('fs').writeFileSync('/tmp/1.bc', bc);
  });
});
