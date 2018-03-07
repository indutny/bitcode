import { Builder } from 'bitcode-builder';
import { Compiler } from '../';

describe('bitcode/compiler', () => {
  let compiler: Compiler;
  let b: Builder;
  beforeEach(() => {
    compiler = new Compiler();
    b = compiler.builder('test.ll');
  });

  it('should compile program', () => {
    // no-op
  });
});
