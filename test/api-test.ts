import { Builder } from 'bitcode-builder';
import { Module } from '../';

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

    const sum = fn.body.binop('add', fn.getArgument('param1'),
      fn.getArgument('param2'));
    fn.body.ret(sum);

    const glob = b.global(b.i(8).ptr(), 'some_global', b.i(8).val(1));

    m.add(fn);
    m.add(glob);

    const bc = m.build();
    console.log(bc);
  });
});
