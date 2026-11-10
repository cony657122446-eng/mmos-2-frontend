const encoder = new TextEncoder();
const crcTable = Array.from({ length: 256 }, (_, n) => {
  for (let i = 0; i < 8; i++) n = n & 1 ? 0xedb88320 ^ n >>> 1 : n >>> 1;
  return n >>> 0;
});
const crc32 = bytes => {
  let value = 0xffffffff;
  for (const byte of bytes) value = crcTable[(value ^ byte) & 255] ^ value >>> 8;
  return (value ^ 0xffffffff) >>> 0;
};
// Stored ZIP keeps PDF bytes intact and needs no external compression service.
export function createContractZip(files) {
  const pieces = [], directory = [];
  let offset = 0;
  for (const file of files) {
    const name = encoder.encode(file.name.replace(/[\\/:*?"<>|]/g, '_'));
    const data = file.bytes instanceof Uint8Array ? file.bytes : encoder.encode(file.bytes);
    const crc = crc32(data), header = new Uint8Array(30 + name.length), view = new DataView(header.buffer);
    view.setUint32(0, 0x04034b50, true); view.setUint16(4, 20, true); view.setUint16(6, 0x0800, true);
    view.setUint32(14, crc, true); view.setUint32(18, data.length, true); view.setUint32(22, data.length, true); view.setUint16(26, name.length, true); header.set(name, 30);
    const central = new Uint8Array(46 + name.length), cv = new DataView(central.buffer);
    cv.setUint32(0, 0x02014b50, true); cv.setUint16(4, 20, true); cv.setUint16(6, 20, true); cv.setUint16(8, 0x0800, true);
    cv.setUint32(16, crc, true); cv.setUint32(20, data.length, true); cv.setUint32(24, data.length, true); cv.setUint16(28, name.length, true); cv.setUint32(42, offset, true); central.set(name, 46);
    pieces.push(header, data); directory.push(central); offset += header.length + data.length;
  }
  const size = directory.reduce((total, bytes) => total + bytes.length, 0), end = new Uint8Array(22), ev = new DataView(end.buffer);
  ev.setUint32(0, 0x06054b50, true); ev.setUint16(8, files.length, true); ev.setUint16(10, files.length, true); ev.setUint32(12, size, true); ev.setUint32(16, offset, true);
  return new Blob([...pieces, ...directory, end], { type: 'application/zip' });
}
