import * as assert from 'assert';

import { Builder, CallingConv, Linkage, types, values } from 'bitcode-builder';
import { Buffer } from 'buffer';

import { Abbr, BitStream } from './bitstream';
import {
  BLOCK_ID, CONSTANTS_CODE, FIXED, FUNCTION_CODE, MODULE_CODE, UNNAMED_ADDR,
  VBR, VISIBILITY,
} from './constants';
import { ConstantList, Enumerator } from './enumerator';
import { Strtab } from './strtab';
import { TypeTable } from './type-table';

const VERSION = 2;
const MODULE_ABBR_ID_WIDTH = 3;
const CONSTANTS_ABBR_ID_WIDTH = 5;
const FUNCTION_ABBR_ID_WIDTH = 6;

export class Module {
  private readonly fns: values.constants.Func[] = [];
  private readonly decls: values.constants.Declaration[] = [];
  private readonly globals: values.Global[] = [];
  private readonly enumerator: Enumerator = new Enumerator();
  private readonly typeTable: TypeTable = new TypeTable();
  private readonly strtab: Strtab = new Strtab();
  private lastValueIndex: number = 0;

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

    this.defineBlockInfo(writer);

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
    this.buildConstants(writer, this.enumerator.getGlobalConstants());
    this.buildDeclarations(writer);
    this.buildFunctionBodies(writer);

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

  private defineBlockInfo(writer: BitStream): void {
    const info: Map<number, Abbr[]> = new Map();

    info.set(BLOCK_ID.CONSTANTS, [
      new Abbr('settype', [
        Abbr.literal(CONSTANTS_CODE.SETTYPE),
        Abbr.vbr(VBR.TYPE_INDEX),
      ]),
      new Abbr('int', [
        Abbr.literal(CONSTANTS_CODE.INTEGER),
        Abbr.vbr(VBR.INTEGER),
      ]),
      new Abbr('null', [
        Abbr.literal(CONSTANTS_CODE.NULL),
      ]),
      new Abbr('undef', [
        Abbr.literal(CONSTANTS_CODE.UNDEF),
      ]),
    ]);

    info.set(BLOCK_ID.FUNCTION, [
      new Abbr('declareblocks', [
        Abbr.literal(FUNCTION_CODE.DECLAREBLOCKS),
        Abbr.vbr(VBR.BLOCK_COUNT),
      ]),
      new Abbr('ret_void', [
        Abbr.literal(FUNCTION_CODE.INST_RET),
      ]),
      new Abbr('ret', [
        Abbr.literal(FUNCTION_CODE.INST_RET),
        Abbr.vbr(VBR.VALUE_INDEX),
      ]),
      new Abbr('binop', [
        Abbr.literal(FUNCTION_CODE.INST_BINOP),
        Abbr.vbr(VBR.VALUE_INDEX),  // left
        Abbr.vbr(VBR.VALUE_INDEX),  // right
        Abbr.fixed(FIXED.BINOP_TYPE),
      ]),
    ]);

    writer.writeBlockInfo(info);
  }

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
      Abbr.fixed(FIXED.BOOL),  // dso_local
    ]));

    for (const g of this.globals) {
      const name = this.strtab.add(g.name);

      this.checkValueOrder(g);

      writer.writeRecord('global', [
        name.offset,
        name.length,
        this.typeTable.get(g.ty),
        g.isConstant() ? 1 : 0,
        g.init === undefined ? 0 : this.enumerator.get(g.init),
        this.encodeLinkage(g.linkage),
        0,  // alignment
        VISIBILITY.DEFAULT,
        0,  // TODO(indutny): attributes
        // dso_local
        (g.linkage === 'private' || g.linkage === 'internal') ? 1 : 0,
      ]);
    }
  }

  private buildConstants(writer: BitStream, list: ConstantList): void {
    if (list.length === 0) {
      return;
    }

    writer.enterBlock(BLOCK_ID.CONSTANTS, CONSTANTS_ABBR_ID_WIDTH);
    let lastType: types.Type | undefined;
    for (const c of list) {
      if (lastType !== c.ty) {
        writer.writeRecord('settype', [ this.typeTable.get(c.ty) ]);
        lastType = c.ty;
      }

      this.checkValueOrder(c);

      if (c.isInt()) {
        writer.writeRecord('int', [ this.encodeSigned(c.toInt().value) ]);
      } else if (c.isNull()) {
        writer.writeRecord('null', []);
      } else if (c.isUndef()) {
        writer.writeRecord('undef', []);
      } else if (c.isMetadata()) {
        // TODO(indutny): emit metadata, but not here
      } else {
        // TODO(indutny): arrays, structs
        throw new Error('Constant encoding not implemented yet');
      }
    }
    writer.endBlock();
  }

  private buildDeclarations(writer: BitStream): void {
    writer.defineAbbr(new Abbr('decl', [
      Abbr.literal(MODULE_CODE.FUNCTION),
      Abbr.vbr(VBR.STRTAB_OFFSET),
      Abbr.vbr(VBR.STRTAB_LENGTH),
      Abbr.vbr(VBR.TYPE_INDEX),
      Abbr.vbr(VBR.CCONV),
      Abbr.fixed(FIXED.BOOL), // isDeclaration
      Abbr.fixed(FIXED.LINKAGE),
      Abbr.vbr(VBR.ATTR_INDEX),
      Abbr.vbr(VBR.ALIGNMENT),
      Abbr.literal(0),  // section
      Abbr.fixed(FIXED.VISIBILITY),
      Abbr.literal(0),  // has GC
      Abbr.literal(UNNAMED_ADDR.NO),  // unnamed_addr
      Abbr.literal(0),  // prologue
      Abbr.literal(0),  // dllstorageclass
      Abbr.literal(0),  // comdat
      Abbr.literal(0),  // personality
      Abbr.fixed(FIXED.BOOL),  // dso_local
    ]));

    const decls =
      (this.fns as values.constants.Declaration[]).concat(this.decls);
    for (const decl of decls) {
      const name = this.strtab.add(decl.name);

      this.checkValueOrder(decl);

      writer.writeRecord('decl', [
        name.offset,
        name.length,
        this.typeTable.get(decl.ty),
        this.encodeCConv(decl.cconv),
        decl.isFunction() ? 0 : 1,  // isDeclaration
        this.encodeLinkage(decl.linkage),
        0,  // TODO(indutny): attributes
        0,  // TODO(indutny): alignment
        VISIBILITY.DEFAULT,

        // dso_local
        (decl.linkage === 'private' || decl.linkage === 'internal') ? 1 : 0,
      ]);
    }
  }

  private buildFunctionBodies(writer: BitStream): void {
    for (const fn of this.fns) {
      writer.enterBlock(BLOCK_ID.FUNCTION, FUNCTION_ABBR_ID_WIDTH);

      this.buildConstants(writer, this.enumerator.getFunctionConstants(fn));

      const blocks = Array.from(fn);
      writer.writeRecord('declareblocks', [ blocks.length ]);

      for (const bb of blocks) {
        for (const instr of bb) {
          this.buildInstruction(writer, instr);
        }
      }

      writer.endBlock();
    }
  }

  private buildInstruction(writer: BitStream,
                           instr: values.instructions.Instruction): void {
    this.checkValueOrder(instr);

    const instrId = this.enumerator.get(instr);
    const relativeId = (operand: values.Value): number => {
      return instrId - this.enumerator.get(operand);
    };

    // TODO(indutny): support forward references
    if (instr instanceof values.instructions.Ret) {
      if (instr.operand === undefined) {
        writer.writeRecord('ret_void', []);
      } else {
        writer.writeRecord('ret', [ relativeId(instr.operand) ]);
      }
    } else if (instr instanceof values.instructions.Binop) {
      writer.writeRecord('binop', [
        relativeId(instr.left),
        relativeId(instr.right),
        this.encodeBinopType(instr.binopType),
      ]);
    }
  }

  // Ensure that values are emitted in the same order they were enumerated
  private checkValueOrder(value: values.Value): void {
    const index = this.enumerator.get(value);
    assert(index >= this.lastValueIndex,
      'Invalid order of values (internal error)');
    this.lastValueIndex = index;
  }

  // TODO(indutny): move to utils?

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

  private encodeCConv(cconv: CallingConv): number {
    switch (cconv) {
      case 'ccc': return 0;
      case 'fastcc': return 8;
      case 'coldcc': return 9;
      case 'webkit_jscc': return 12;
      case 'anyregcc': return 13;
      case 'preserve_mostcc': return 14;
      case 'preserve_allcc': return 15;
      case 'swiftcc': return 16;
      case 'cxx_fast_tlscc': return 17;
      case 'x86_stdcallcc': return 64;
      case 'x86_fastcallcc': return 65;
      case 'arm_apcscc': return 66;
      case 'arm_aapcscc': return 67;
      case 'arm_aapcs_vfpcc': return 6;
      default: throw new Error(`Unsupported cconv: "${cconv}"`);
    }
  }

  // TODO(indutny): int64 support
  private encodeSigned(value: number): number {
    value |= 0;

    if (value < 0) {
      return (-value << 1) | 1;
    } else {
      return value << 1;
    }
  }

  private encodeCastType(cast: values.instructions.CastType) {
    switch (cast) {
      case 'trunc': return 0;
      case 'zext': return 1;
      case 'sext': return 2;
      case 'fptoui': return 3;
      case 'fptosi': return 4;
      case 'uitofp': return 5;
      case 'sitofp': return 6;
      case 'fptrunc': return 7;
      case 'fpext': return 8;
      case 'ptrtoint': return 9;
      case 'inttoptr': return 10;
      case 'bitcast': return 11;
      case 'addrspacecast': return 12;
      default: throw new Error(`Unsupported cast type: "${cast}"`);
    }
  }

  private encodeBinopType(binop: values.instructions.BinopType) {
    switch (binop) {
      case 'add': return 0;
      case 'sub': return 1;
      case 'mul': return 2;
      case 'udiv': return 3;
      case 'sdiv': return 4;
      case 'urem': return 5;
      case 'srem': return 6;
      case 'shl': return 7;
      case 'lshr': return 8;
      case 'ashr': return 9;
      case 'and': return 10;
      case 'or': return 11;
      case 'xor': return 12;
      default: throw new Error(`Unsupported binop type: "${binop}"`);
    }
  }
}
