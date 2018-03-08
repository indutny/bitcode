import * as assert from 'assert';

import { BitStream } from '../lib/bitstream';

describe('bitcode/bitstream', () => {
  let b: BitStream;
  beforeEach(() => {
    b = new BitStream();
  });

  describe('32-bit vbr', () => {
    it('should write short 6-bit vbr', () => {
      b.writeVBR(0x3, 6);
      assert.strictEqual(b.end().slice(4).toString('hex'), '03');
    });

    it('should write long 6-bit vbr', () => {
      b.writeVBR(0xabba, 6);
      assert.strictEqual(b.end().slice(4).toString('hex'), '7aaf06');
    });
  });

  describe('64-bit vbr', () => {
    it('should write short 6-bit vbr', () => {
      b.writeVBR([ 0, 0x3 ], 6);
      assert.strictEqual(b.end().slice(4).toString('hex'), '03');
    });

    it('should write long 6-bit vbr', () => {
      b.writeVBR([ 0xabbaabba, 0xc0dec0de ], 6);
      assert.strictEqual(b.end().slice(4).toString('hex'),
        'be09f72db8de6bedde0a');
    });
  });
});
