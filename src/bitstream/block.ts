import * as assert from 'assert';

import { Abbr } from './abbr';

const MIN_ABBR_ID_WIDTH = 2;
const ABBR_INDEX_OFF = 4;

export interface IAbbrMapEntry {
  readonly abbr: Abbr;
  readonly index: number;
}

export class Block {
  protected abbrList: Abbr[] = [];

  // abbr.name => entry
  protected abbrMap: Map<string, IAbbrMapEntry> = new Map();

  constructor(public readonly id: number, public readonly abbrIDWidth: number,
              globalAbbrs: ReadonlyArray<Abbr>) {
    assert(MIN_ABBR_ID_WIDTH <= abbrIDWidth, 'AbbrID width is too small');

    globalAbbrs.forEach((abbr) => this.addAbbr(abbr));
  }

  public addAbbr(abbr: Abbr): number {
    assert(!this.abbrMap.has(abbr.name),
      `Duplicate abbreviation with name: "${abbr.name}"`);

    const index = this.abbrList.length + ABBR_INDEX_OFF;

    this.abbrList.push(abbr);
    this.abbrMap.set(abbr.name, { abbr, index });

    return index;
  }

  public getAbbr(name: string): IAbbrMapEntry | undefined {
    return this.abbrMap.get(name);
  }

  public hasAbbr(name: string): boolean {
    return this.abbrMap.has(name);
  }
}
