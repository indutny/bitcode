import * as assert from 'assert';

import { Abbr, BitStream } from '../src/bitstream';

describe('bitcode/bitstream', () => {
  let b: BitStream;
  beforeEach(() => {
    b = new BitStream();
  });

  function check(s: BitStream, expected: string): void {
    assert.strictEqual(s.end().slice(4).toString('hex'), expected);
  }

  describe('32-bit vbr', () => {
    it('should write short 6-bit vbr', () => {
      check(b.writeVBR(0x3, 6), '03');
    });

    it('should write long 6-bit vbr', () => {
      check(b.writeVBR(0xabba, 6), '7aaf06');
    });
  });

  describe('64-bit vbr', () => {
    it('should write short 6-bit vbr', () => {
      check(b.writeVBR([ 0, 0x3 ], 6), '03');
    });

    it('should write long 6-bit vbr', () => {
      check(b.writeVBR([ 0xabbaabba, 0xc0dec0de ], 6), 'be09f72db8de6bedde0a');
    });
  });

  it('should enter and leave blocks', () => {
    b.enterBlock(8, 2);
    b.endBlock();

    check(b, '210800000100000000000000');
  });

  it('should enter and leave subblocks', () => {
    b.enterBlock(8, 4);
    b.enterBlock(9, 6);
    b.endBlock();
    b.endBlock();

    check(b, '211000000400000091600000010000000000000000000000');
  });

  it('should define and use abbreviation', () => {
    const a = new Abbr('source', [
      Abbr.literal(16), Abbr.array(Abbr.char6()),
    ]);
    b.enterBlock(8, 4);

    b.defineAbbr(a);

    // SOURCE
    b.writeRecord('source', [ 'hello_world' ]);

    b.endBlock();

    check(b, '2110000004000000324218d27210cbe2fc96132d03000000');
  });

  it('should write BLOCKINFO', () => {
    b.enterBlock(8, 4);

    const a = new Abbr('source', [
      Abbr.literal(16), Abbr.array(Abbr.char6()),
    ]);

    const info = new Map();
    info.set(17, [ a ]);

    b.writeBlockInfo(info);

    b.endBlock();

    check(b, '211000000500000001200000020000000741e4086108000000000000');
  });
});
