import * as assert from 'assert';
import { Buffer } from 'buffer';

const CHUNK_SIZE = 16 * 1024;

export class ByteWriter {
  // Total size of all pushed chunks in bytes
  private size: number = 0;

  // Current chunk
  private current: Buffer = Buffer.alloc(CHUNK_SIZE);

  // Offset in current chunk
  private chunkOffset: number = 0;

  // Bytes left in current chunk
  private chunkLeft: number = CHUNK_SIZE;

  // Array of completed chunks
  private chunks: Buffer[] = [];

  public get offset(): number { return this.size + this.chunkOffset; }

  public writeByte(val: number): ByteWriter {
    const chunk = this.ensureChunk();

    // We have at least one byte here
    chunk[this.chunkOffset++] = val;
    this.chunkLeft--;

    return this;
  }

  public writeWord(val: number): ByteWriter {
    const chunk = this.ensureChunk();

    if (this.chunkLeft >= 2) {
      chunk.writeUInt16LE(val & 0xffff, this.chunkOffset);
      this.chunkLeft -= 2;
      this.chunkOffset += 2;
      return this;
    }

    // Just one byte available
    this.writeByte(val & 0xff);
    this.writeByte((val >>> 8) & 0xff);

    return this;
  }

  public writeDWord(val: number): ByteWriter {
    const chunk = this.ensureChunk();

    if (this.chunkLeft >= 4) {
      chunk.writeUInt32LE(val | 0, this.chunkOffset);
      this.chunkLeft -= 4;
      this.chunkOffset += 4;
      return this;
    }

    // Less than four bytes available
    this.writeWord(val & 0xffff);
    this.writeWord((val >>> 16) & 0xffff);

    return this;
  }

  public reserve(bytes: number): Buffer {
    this.flush();
    const chunk = this.ensureChunk();
    assert(this.chunkLeft >= bytes, '`reserve()` OOB');

    const endOff = this.chunkOffset + bytes;
    const res = this.current.slice(this.chunkOffset, endOff);
    this.chunkLeft -= bytes;
    this.chunkOffset = endOff;
    return res;
  }

  public end(): Buffer {
    this.flush();
    return Buffer.concat(this.chunks, this.size);
  }

  // Private
  private push(chunk: Buffer): void {
    this.chunks.push(chunk);
    this.size += chunk.length;
  }

  private ensureChunk(): Buffer {
    if (this.chunkLeft !== 0) {
      return this.current;
    }

    // No push after `flush`
    if (this.chunkOffset !== 0) {
      this.push(this.current);
    }

    this.chunkOffset = 0;
    this.chunkLeft = CHUNK_SIZE;
    this.current = Buffer.alloc(CHUNK_SIZE);

    return this.current;
  }

  private flush(): void {
    if (this.chunkOffset === 0) {
      return;
    }

    this.push(this.current.slice(0, this.chunkOffset));
    this.chunkOffset = 0;
    this.chunkLeft = 0;
  }
}
