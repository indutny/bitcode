import { Builder, Linkage, values } from 'bitcode-builder';
import { Buffer } from 'buffer';

import { Abbr, BitStream } from './bitstream';
import {
  BLOCK_ID, FIXED, MODULE_CODE, UNNAMED_ADDR, VBR, VISIBILITY,
} from './constants';
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
        Abbr.array(Abbr.fixed(FIXED.CHAR)),
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

    writer.endBlock();

    // Build STRTAB last, when we've added all strings to it
    this.strtab.build(writer);

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

  // TODO(indutny): support section, alignment, etc
  private buildGlobals(writer: BitStream): void {
    writer.defineAbbr(new Abbr('global', [
      Abbr.literal(MODULE_CODE.GLOBALVAR),
      Abbr.vbr(VBR.STRTAB_OFFSET),
      Abbr.vbr(VBR.STRTAB_LENGTH),
      Abbr.vbr(VBR.TYPE_INDEX), // pointer type
      Abbr.fixed(FIXED.BOOL), // isConstant
      Abbr.vbr(VBR.VALUE_INDEX), // init
      Abbr.fixed(FIXED.LINKAGE),
      Abbr.vbr(VBR.ALIGNMENT),
      Abbr.literal(0),  // section
      Abbr.fixed(FIXED.VISIBILITY),
      Abbr.literal(0),  // threadlocal
      Abbr.literal(UNNAMED_ADDR.NO),  // unnamed_addr
      Abbr.literal(0),  // is_externally_initialized
      Abbr.literal(0),  // dllstorageclass
      Abbr.literal(0),  // comdat
      Abbr.vbr(VBR.ATTR_INDEX),
      Abbr.literal(0),  // preemption specifier
    ]));

    for (const g of this.globals) {
      const name = this.strtab.add(g.name);

      writer.writeRecord('global', [
        name.offset,
        name.length,
        this.typeTable.get(g.ty),
        g.isConstant() ? 1 : 0,
        0,
        this.encodeLinkage(g.linkage),
        0,  // alignment
        VISIBILITY.DEFAULT,
        0,  // TODO(indutny): attributes
      ]);
    }
  }

  private encodeLinkage(linkage: Linkage): number {
    switch (linkage) {
      case 'external': return 0;
      case 'weak': return 1;
      case 'appending': return 2;
      case 'internal': return 3;
      case 'linkonce': return 4;
      case 'dllimport': return 5;
      case 'dllexport': return 6;
      case 'extern_weak': return 7;
      case 'common': return 8;
      case 'private': return 9;
      case 'weak_odr': return 10;
      case 'linkonce_odr': return 11;
      case 'available_externally': return 12;
      default: throw new Error(`Unsupported linkage type: "${linkage}"`);
    }
  }
}
