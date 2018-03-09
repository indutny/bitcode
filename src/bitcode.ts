import * as assert from 'assert';

import { Builder, types, values } from 'bitcode-builder';
import { Buffer } from 'buffer';

import { Abbr, BitStream, BlockInfoMap } from './bitstream';
import { ConstantBlock, StrtabBlock } from './blocks';
import {
  BLOCK_ID, FIXED, FUNCTION_CODE, MODULE_CODE, UNNAMED_ADDR,
  VALUE_SYMTAB_CODE, VBR, VISIBILITY,
} from './constants';
import { encodeBinopType, encodeCConv, encodeLinkage } from './encoding';
import { ConstantList, Enumerator } from './enumerator';
import { TypeTable } from './type-table';

import constants = values.constants;
import instructions = values.instructions;

const VERSION = 2;
const MODULE_ABBR_ID_WIDTH = 3;
const FUNCTION_ABBR_ID_WIDTH = 6;
const VALUE_SYMTAB_ABBR_ID_WIDTH = 3;

export class Module {
  private readonly fns: constants.Func[] = [];
  private readonly decls: constants.Declaration[] = [];
  private readonly globals: values.Global[] = [];
  private readonly enumerator: Enumerator = new Enumerator();
  private readonly typeTable: TypeTable = new TypeTable();
  private readonly strtab: StrtabBlock = new StrtabBlock();

  constructor(public readonly sourceName?: string) {
  }

  public addFunction(fn: constants.Func): void {
    this.fns.push(fn);
  }

  public addDeclaration(decl: constants.Declaration): void {
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

    const globalConstants = new ConstantBlock(this.enumerator, this.typeTable,
      this.enumerator.getGlobalConstants());

    globalConstants.build(writer);

    this.buildDeclarations(writer);
    this.buildFunctionBodies(writer);

    writer.endBlock(BLOCK_ID.MODULE);

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
    if (value instanceof constants.Func) {
      this.addFunction(value);
    } else if (value instanceof constants.Declaration) {
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
    const info: BlockInfoMap = new Map();

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

    info.set(BLOCK_ID.VALUE_SYMTAB, [
      new Abbr('bbentry', [
        Abbr.literal(VALUE_SYMTAB_CODE.BBENTRY),
        Abbr.vbr(VBR.BLOCK_INDEX),
        Abbr.array(Abbr.char6()),
      ]),
      new Abbr('entry', [
        Abbr.literal(VALUE_SYMTAB_CODE.ENTRY),
        Abbr.vbr(VBR.VALUE_INDEX),
        Abbr.array(Abbr.char6()),
      ]),
    ]);

    ConstantBlock.buildInfo(info);

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

      this.enumerator.checkValueOrder(g);

      writer.writeRecord('global', [
        name.offset,
        name.length,
        this.typeTable.get(g.ty),
        g.isConstant() ? 1 : 0,
        g.init === undefined ? 0 : 1 + this.enumerator.get(g.init),
        encodeLinkage(g.linkage),
        0,  // alignment
        VISIBILITY.DEFAULT,
        0,  // TODO(indutny): attributes
        // dso_local
        (g.linkage === 'private' || g.linkage === 'internal') ? 1 : 0,
      ]);
    }
  }

  private buildDeclarations(writer: BitStream): void {
    // TODO(indutny): support unnamed_addr, others?
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

    const decls = (this.fns as constants.Declaration[]).concat(this.decls);
    for (const decl of decls) {
      const name = this.strtab.add(decl.name);

      this.enumerator.checkValueOrder(decl);

      writer.writeRecord('decl', [
        name.offset,
        name.length,
        this.typeTable.get(decl.ty),
        encodeCConv(decl.cconv),
        decl.isFunction() ? 0 : 1,  // isDeclaration
        encodeLinkage(decl.linkage),
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

      const fnConstants = new ConstantBlock(this.enumerator, this.typeTable,
        this.enumerator.getFunctionConstants(fn));
      fnConstants.build(writer);

      const blocks = Array.from(fn);
      writer.writeRecord('declareblocks', [ blocks.length ]);

      for (const bb of blocks) {
        for (const instr of bb) {
          this.buildInstruction(writer, instr);
        }
      }

      // Write block/param names
      writer.enterBlock(BLOCK_ID.VALUE_SYMTAB, VALUE_SYMTAB_ABBR_ID_WIDTH);

      blocks.forEach((bb, index) => {
        if (bb.name === undefined) {
          return;
        }

        writer.writeRecord('bbentry', [ index, bb.name ]);
      });

      fn.args.forEach((arg, index) => {
        writer.writeRecord('entry', [ this.enumerator.get(arg), arg.name ]);
      });

      writer.endBlock(BLOCK_ID.VALUE_SYMTAB);

      writer.endBlock(BLOCK_ID.FUNCTION);
    }
  }

  private buildInstruction(writer: BitStream,
                           instr: instructions.Instruction): void {
    this.enumerator.checkValueOrder(instr);

    const instrId = this.enumerator.get(instr);
    const relativeId = (operand: values.Value): number => {
      return instrId - this.enumerator.get(operand);
    };

    // TODO(indutny): support forward references
    if (instr instanceof instructions.Ret) {
      if (instr.operand === undefined) {
        writer.writeRecord('ret_void', []);
      } else {
        writer.writeRecord('ret', [ relativeId(instr.operand) ]);
      }
    } else if (instr instanceof instructions.Binop) {
      writer.writeRecord('binop', [
        relativeId(instr.left),
        relativeId(instr.right),
        encodeBinopType(instr.binopType),
      ]);
    }
  }
}
