import { types } from 'bitcode-builder';
import { Abbr, BitStream, BlockInfoMap } from '../bitstream';
import { BLOCK_ID, CONSTANTS_CODE, VBR } from '../constants';
import { encodeSigned } from '../encoding';
import { ConstantList } from '../enumerator';
import { Builder } from './base';

const CONSTANTS_ABBR_ID_WIDTH = 5;

export class ConstantBuilder extends Builder {
  public buildInfo(info: BlockInfoMap): void {
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
      new Abbr('aggr', [
        Abbr.literal(CONSTANTS_CODE.AGGREGATE),
        Abbr.array(Abbr.vbr(VBR.VALUE_INDEX)),
      ]),
    ]);
  }

  public build(writer: BitStream, list: ConstantList): void {
    if (list.length === 0) {
      return;
    }

    writer.enterBlock(BLOCK_ID.CONSTANTS, CONSTANTS_ABBR_ID_WIDTH);
    let lastType: types.Type | undefined;
    for (const c of list) {
      if (lastType === undefined || !lastType.isEqual(c.ty)) {
        writer.writeRecord('settype', [ this.typeTable.get(c.ty) ]);
        lastType = c.ty;
      }

      this.enumerator.checkValueOrder(c);

      if (c.isInt()) {
        writer.writeRecord('int', [ encodeSigned(c.toInt().value) ]);
      } else if (c.isNull()) {
        writer.writeRecord('null', []);
      } else if (c.isUndef()) {
        writer.writeRecord('undef', []);
      } else if (c.isArray()) {
        const elems = c.toArray().elems;
        writer.writeRecord('aggr', [ elems.map((e) => {
          return this.enumerator.get(e);
        }) ]);
      } else if (c.isArray()) {
        const fields = c.toStruct().fields;
        writer.writeRecord('aggr', [ fields.map((e) => {
          return this.enumerator.get(e);
        }) ]);
      } else if (c.isMetadata()) {
        // TODO(indutny): emit metadata, but not here
        throw new Error('Implement me!');
      } else {
        throw new Error(`Unexpected constant value: "${c.constructor.name}"`);
      }
    }
    writer.endBlock();
  }
}
