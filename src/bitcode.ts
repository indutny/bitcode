import * as assert from 'assert';

import { Builder, values } from 'bitcode-builder';
import { Buffer } from 'buffer';

import { Abbr, BitStream, BlockInfoMap } from './bitstream';
import {
  ConstantBlock, FunctionBlock, MetadataBlock, MetadataKindBlock,
  ParamAttrBlock, StrtabBlock, TypeBlock,
} from './blocks';
import {
  BLOCK_ID, FIXED, MODULE_CODE, UNNAMED_ADDR, VBR, VISIBILITY,
} from './constants';
import { encodeCConv, encodeLinkage } from './encoding';
import { Enumerator } from './enumerator';

import constants = values.constants;

const MAGIC = 0xdec04342;
const VERSION = 2;
const MODULE_ABBR_ID_WIDTH = 3;

export { Builder };

export class Module {
  private readonly usedNames = new Set();
  private readonly fns: constants.Func[] = [];
  private readonly decls: Map<string, constants.Declaration> = new Map();
  private readonly globals: Map<string, values.Global> = new Map();
  private readonly enumerator: Enumerator = new Enumerator();
  private readonly typeBlock: TypeBlock = new TypeBlock();
  private readonly paramAttrBlock: ParamAttrBlock = new ParamAttrBlock();
  private readonly strtab: StrtabBlock = new StrtabBlock();

  constructor(public readonly sourceName?: string) {
  }

  public addFunction(fn: constants.Func): void {
    this.useGlobalName(fn.name);
    this.fns.push(fn);
  }

  public addDeclaration(decl: constants.Declaration): void {
    if (this.decls.has(decl.name)) {
      const existing = this.decls.get(decl.name)!;
      assert(decl.isEqual(existing),
        'Declaration already exists with a different spec');

      // TODO(indutny): verify attributes
      return;
    }

    this.useGlobalName(decl.name);
    this.decls.set(decl.name, decl);
  }

  public addGlobal(g: values.Global): void {
    if (this.globals.has(g.name)) {
      const existing = this.globals.get(g.name)!;
      // TODO(indutny): linkage, and so on
      assert(g.ty.isEqual(existing.ty),
        'Global already exists with a different type: ' +
        `"${existing.ty.typeString}"`);
      return;
    }
    this.useGlobalName(g.name);
    this.globals.set(g.name, g);
  }

  public build(): Buffer {
    const writer: BitStream = new BitStream({
      magic: MAGIC,
    });

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

    const decls = Array.from(this.decls.values());
    const globals = Array.from(this.globals.values());

    // LLVM enumerates values in specific order, attach id to each before
    // emitting binary data
    this.enumerator.enumerate({
      decls,
      fns: this.fns,
      globals,
    });

    // Add types from used values
    for (const value of this.enumerator) {
      this.typeBlock.add(value.ty);
    }

    this.typeBlock.build(writer);

    // Add attributes from globals
    for (const global of globals) {
      this.paramAttrBlock.addGlobal(global);
    }

    // Add attributes from declarations
    for (const decl of decls) {
      this.paramAttrBlock.addDecl(decl);
    }

    // Add attributes from functions
    for (const fn of this.fns) {
      this.paramAttrBlock.addDecl(fn);
    }

    const metadataKindBlock = new MetadataKindBlock(
      this.enumerator.getMetadataKinds());
    metadataKindBlock.build(writer);

    this.paramAttrBlock.build(writer);

    this.buildGlobals(writer, globals);

    const globalConstants = new ConstantBlock(this.enumerator, this.typeBlock,
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

    ConstantBlock.buildInfo(info);
    FunctionBlock.buildInfo(info);
    MetadataBlock.buildInfo(info);

    writer.writeBlockInfo(info);
  }

  // TODO(indutny): support section, alignment, etc
  // TODO(indutny): metadata
  private buildGlobals(writer: BitStream, globals: values.Global[]): void {
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

    for (const g of globals) {
      const name = this.strtab.add(g.name);

      this.enumerator.checkValueOrder(g);

      const attributes = this.paramAttrBlock.get(g);

      writer.writeRecord('global', [
        name.offset,
        name.length,
        this.typeBlock.get(g.ty),
        g.hasConstantValue() ? 1 : 0,
        g.init === undefined ? 0 : 1 + this.enumerator.get(g.init),
        encodeLinkage(g.linkage),
        0,  // alignment
        VISIBILITY.DEFAULT,
        attributes === undefined ? 0 : 1 + attributes,
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
      Abbr.literal(0),  // prefix
      Abbr.literal(0),  // personality
      Abbr.fixed(FIXED.BOOL),  // dso_local
    ]));

    const allDecls = (this.fns as constants.Declaration[])
      .concat(Array.from(this.decls.values()));
    for (const decl of allDecls) {
      const name = this.strtab.add(decl.name);

      this.enumerator.checkValueOrder(decl);

      const attributes = this.paramAttrBlock.get(decl);

      writer.writeRecord('decl', [
        name.offset,
        name.length,
        this.typeBlock.get(decl.ty),
        encodeCConv(decl.cconv),
        decl.isFunction() ? 0 : 1,  // isDeclaration
        encodeLinkage(decl.linkage),
        attributes === undefined ? 0 : 1 + attributes,
        0,  // TODO(indutny): alignment
        VISIBILITY.DEFAULT,

        // dso_local
        (decl.linkage === 'private' || decl.linkage === 'internal') ? 1 : 0,
      ]);
    }
  }

  private buildFunctionBodies(writer: BitStream): void {
    for (const fn of this.fns) {
      const block = new FunctionBlock(this.enumerator, this.typeBlock, fn);
      block.build(writer);
    }
  }

  private useGlobalName(name: string) {
    if (this.usedNames.has(name)) {
      throw new Error(`Global name clash for: "${name}"`);
    }
    this.usedNames.add(name);
  }
}
