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
    const fn = b.signature(b.i(32), [ b.i(32), b.i(32) ]).defineFunction(
      'fn_name',
      [ 'param1', 'param2' ],
    );
    fn.body.name = 'start';

    const sum = fn.body.binop('add', fn.getArgument('param1'),
      fn.getArgument('param2'));

    const bb1 = fn.createBlock('bb1');
    fn.body.jmp(bb1);

    const sum2 = bb1.binop('add', sum, b.i(32).val(123));
    bb1.ret(sum2);

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
    m.add(glob);

    const bc = m.build();
    require('fs').writeFileSync('/tmp/1.bc', bc);
  });
});
