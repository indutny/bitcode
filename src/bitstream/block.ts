import * as assert from 'assert';

import { Abbr } from './abbr';

export class Block {
  protected abbrList: Abbr[] = [];

  // abbr.name => index in `abbrList`
  protected abbrMap: Map<string, number> = new Map();

  constructor(public readonly abbrWidth: number, blockInfo?: Block) {
    if (blockInfo !== undefined) {
      blockInfo.abbrList.forEach((abbr) => this.addAbbr(abbr));
    }
  }

  public addAbbr(abbr: Abbr): number {
    assert(!this.abbrMap.has(abbr.name),
      `Duplicate abbreviation with name: "${abbr.name}"`);

    const index = this.abbrList.length;

    this.abbrList.push(abbr);
    this.abbrMap.set(abbr.name, index);

    return index;
  }
}
