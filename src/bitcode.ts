import { Builder } from 'bitcode-builder';

export class Compiler {
  public builder(sourceName?: string) {
    return new Builder(sourceName);
  }
}
