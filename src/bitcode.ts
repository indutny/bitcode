import { Builder, values } from 'bitcode-builder';
import { Buffer } from 'buffer';

import { BitStream } from './bitstream';
import { BLOCK_ID, MODULE_CODE } from './constants';
import { Enumerator } from './enumerator';
import { TypeTable } from './type-table';

const MODULE_ABBR_ID_WIDTH = 3;

export class Module {
  private readonly fns: values.constants.Func[] = [];
  private readonly decls: values.constants.Declaration[] = [];
  private readonly globals: values.Global[] = [];
  private readonly writer: BitStream = new BitStream();
  private readonly typeTable: TypeTable = new TypeTable();

  constructor(public readonly sourceName?: string) {
    this.writer.enterBlock(BLOCK_ID.MODULE, MODULE_ABBR_ID_WIDTH);

    if (sourceName !== undefined) {
      const bytes = Array.from(Buffer.from(sourceName));
      this.writer.writeUnabbrRecord(MODULE_CODE.SOURCE_FILENAME, bytes);
    }
  }

  public addFunction(fn: values.constants.Func): void {
    this.fns.push(fn);
  }

  public addDeclaration(decl: values.constants.Declaration): void {
    this.decls.push(decl);
  }

  public addGlobal(g: values.Global): void {
    this.globals.push(g);
  }

  public build(): Buffer {
    // TODO(indutny): prevent double-invocation

    // LLVM enumerates values in specific order, attach id to each before
    // emitting binary data
    const e = new Enumerator();
    e.enumerate({
      decls: this.decls,
      fns: this.fns,
      globals: this.globals,
    });

    this.typeTable.build(this.writer);

    this.writer.endBlock();
    return this.writer.end();
  }

  // Convenience methods

  public createBuilder() {
    return new Builder();
  }

  public add(value: values.Value): Module {
    // NOTE: test `Func` first since it is a subclass of `Declaration`
    if (value instanceof values.constants.Func) {
      this.addFunction(value);
    } else if (value instanceof values.constants.Declaration) {
      this.addDeclaration(value);
    } else if (value instanceof values.Global) {
      this.addGlobal(value);
    } else {
      throw new Error('Unexpected value type: ' + value.constructor.name);
    }
    return this;
  }
}
