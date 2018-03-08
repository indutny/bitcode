import { Builder, values } from 'bitcode-builder';
import { Buffer } from 'buffer';

import { Abbr, BitStream } from './bitstream';
import { BLOCK_ID, MODULE_CODE } from './constants';
import { Enumerator } from './enumerator';
import { TypeTable } from './type-table';

const VERSION = 2;
const MODULE_ABBR_ID_WIDTH = 3;

export class Module {
  private readonly fns: values.constants.Func[] = [];
  private readonly decls: values.constants.Declaration[] = [];
  private readonly globals: values.Global[] = [];
  private readonly writer: BitStream = new BitStream();
  private readonly enumerator: Enumerator = new Enumerator();
  private readonly typeTable: TypeTable = new TypeTable();

  constructor(public readonly sourceName?: string) {
    this.writer.enterBlock(BLOCK_ID.MODULE, MODULE_ABBR_ID_WIDTH);
    this.writer.writeUnabbrRecord(MODULE_CODE.VERSION, [ VERSION ]);

    if (sourceName !== undefined) {
      const arr = Array.from(Buffer.from(sourceName));

      // TODO(indutny): use char6, or fixed7 if compatible
      this.writer.defineAbbr(new Abbr('filename', [
        Abbr.literal(MODULE_CODE.SOURCE_FILENAME),
        Abbr.array(Abbr.fixed(8)),
      ]));
      this.writer.writeRecord('filename', [ arr ]);
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
    this.enumerator.enumerate({
      decls: this.decls,
      fns: this.fns,
      globals: this.globals,
    });

    // Add types from used values
    for (const value of this.enumerator) {
      this.typeTable.add(value.ty);
    }

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
