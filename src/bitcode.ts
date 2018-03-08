import { Builder, values } from 'bitcode-builder';
import { Buffer } from 'buffer';

import { Abbr, BitStream } from './bitstream';
import { BLOCK_ID, MODULE_CODE } from './constants';
import { Enumerator } from './enumerator';
import { Strtab } from './strtab';
import { TypeTable } from './type-table';

const VERSION = 2;
const MODULE_ABBR_ID_WIDTH = 3;

export class Module {
  private readonly fns: values.constants.Func[] = [];
  private readonly decls: values.constants.Declaration[] = [];
  private readonly globals: values.Global[] = [];
  private readonly enumerator: Enumerator = new Enumerator();
  private readonly typeTable: TypeTable = new TypeTable();
  private readonly strtab: Strtab = new Strtab();

  constructor(public readonly sourceName?: string) {
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
    const writer: BitStream = new BitStream();

    writer.enterBlock(BLOCK_ID.MODULE, MODULE_ABBR_ID_WIDTH);
    writer.writeUnabbrRecord(MODULE_CODE.VERSION, [ VERSION ]);

    if (this.sourceName !== undefined) {
      const arr = Array.from(Buffer.from(this.sourceName));

      // TODO(indutny): use char6, or fixed7 if compatible
      writer.defineAbbr(new Abbr('filename', [
        Abbr.literal(MODULE_CODE.SOURCE_FILENAME),
        Abbr.array(Abbr.fixed(8)),
      ]));
      writer.writeRecord('filename', [ arr ]);
    }

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

    this.typeTable.build(writer);

    this.buildGlobals(writer);

    // Build STRTAB last, when we've added all strings to it
    this.strtab.build(writer);

    writer.endBlock();
    return writer.end();
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

  // Private API

  private buildGlobals(writer: BitStream): void {
    writer.defineAbbr(new Abbr('global', [
      Abbr.literal(MODULE_CODE.GLOBALVAR),
    ]));

    for (const g of this.globals) {
      const name = this.strtab.add(g.name);
    }
  }
}
