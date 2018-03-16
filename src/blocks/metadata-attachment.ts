import { values } from 'bitcode-builder';
import { BitStream } from '../bitstream';
import { BLOCK_ID, METADATA_ATTACHMENT_CODE } from '../constants';
import { Block } from './base';
import { MetadataBlock } from './metadata';

import constants = values.constants;

const METADATA_ATTACHMENT_ABBR_ID_WIDTH = 3;

interface IMetadataAttachmentItem {
  readonly key: number;
  readonly metadata: constants.Metadata;
}

interface IMetadataAttachment {
  readonly instrId: number;
  readonly items: IMetadataAttachmentItem[];
}

export class MetadataAttachmentBlock extends Block {
  constructor(private readonly metadataBlock: MetadataBlock,
              private readonly fn: constants.Func,
              private kinds: ReadonlyMap<string, number>) {
    super();
  }

  public build(writer: BitStream): void {
    super.build(writer);

    let instrId: number = 0;
    const attachments: IMetadataAttachment[] = [];
    for (const bb of this.fn) {
      for (const i of bb) {
        const items: IMetadataAttachmentItem[] = [];
        i.metadata.forEach((metadata, key) => {
          items.push({ key: this.kinds.get(key)!, metadata });
        });

        if (items.length !== 0) {
          attachments.push({ instrId, items });
        }
        instrId++;
      }
    }

    if (attachments.length === 0) {
      return;
    }

    writer.enterBlock(BLOCK_ID.METADATA_ATTACHMENT,
      METADATA_ATTACHMENT_ABBR_ID_WIDTH);
    attachments.forEach((attachment) => {
      const operands = [ attachment.instrId ];

      attachment.items.forEach((item) => {
        operands.push(item.key, this.metadataBlock.get(item.metadata));
      });

      writer.writeUnabbrRecord(METADATA_ATTACHMENT_CODE.ATTACHMENT, operands);
    });
    writer.endBlock(BLOCK_ID.METADATA_ATTACHMENT);
  }
}
