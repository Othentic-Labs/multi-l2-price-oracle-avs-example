import * as mcl from 'mcl-wasm';
import { ethers } from 'ethers';

const FIELD_ORDER = BigInt(
  '0x30644e72e131a029b85045b68181585d97816a916871ca8d3c208c16d87cfd47'
);

let initialized = false;

export async function init(): Promise<void> {
  if (!initialized) {
    await mcl.init(mcl.BN_SNARK1);
    mcl.setMapToMode(mcl.BN254);
    initialized = true;
  }
}

export function getSigningKey(seed: string): mcl.Fr {
  return parseFr(prefixSeed(seed));
}

export function getPublicKey(signingKey: mcl.Fr): mcl.G2 {
  const pubKey = mcl.mul(g2(), signingKey);
  pubKey.normalize();
  return pubKey;
}

export function sign(signingKey: mcl.Fr, message: string): string {
  const messagePoint = hashToPoint(message, domain());
  const signature = mcl.mul(messagePoint, signingKey);
  signature.normalize();
  const sig = g1ToHex(signature);
  return JSON.stringify({ x: sig[0], y: sig[1] });
}

function parseFr(hex: string): mcl.Fr {
  if (!ethers.isHexString(hex)) {
    throw new Error('Invalid hex string');
  }
  const fr = new mcl.Fr();
  fr.setHashOf(hex);
  return fr;
}

function prefixSeed(seed: string): string {
  return seed.startsWith('0x') ? seed : `0x${seed}`;
}

function hashToPoint(message: string, domain: Uint8Array): mcl.G1 {
  if (!ethers.isHexString(message)) {
    throw new Error('message is expected to be hex string');
  }

  const msgBytes = ethers.getBytes(message);
  const [e0, e1] = hashToField(domain, msgBytes, 2);
  const p0 = mapToPoint(e0);
  const p1 = mapToPoint(e1);
  const p = mcl.add(p0, p1);
  p.normalize();
  return p;
}

function mapToPoint(e: bigint): mcl.G1 {
  const e1 = new mcl.Fp();
  e1.setStr((e % FIELD_ORDER).toString());
  return e1.mapToG1();
}

function hashToField(domain: Uint8Array, msg: Uint8Array, count: number): bigint[] {
  const u = 48;
  const expanded = expandMsg(domain, msg, count * u);
  const result: bigint[] = [];

  for (let i = 0; i < count; i++) {
    const slice = expanded.slice(i * u, (i + 1) * u);
    result.push(ethers.toBigInt(slice) % FIELD_ORDER);
  }
  return result;
}

function toBigEndian(p: mcl.Fp): Uint8Array {
  return p.serialize().reverse();
}

function g1ToHex(p: mcl.G1): [string, string] {
  p.normalize();
  const x = ethers.hexlify(toBigEndian(p.getX()));
  const y = ethers.hexlify(toBigEndian(p.getY()));
  return [x, y];
}

function g2(): mcl.G2 {
  const g = new mcl.G2();
  g.setStr(
    '1 0x1800deef121f1e76426a00665e5c4479674322d4f75edadd46debd5cd992f6ed' +
    ' 0x198e9393920d483a7260bfb731fb5d25f1aa493335a9e71297e485b7aef312c2' +
    ' 0x12c85ea5db8c6deb4aab71808dcb408fe3d1e7690c43d37b4ce6cc0166fa7daa' +
    ' 0x090689d0585ff075ec9e99ad690c3395bc4b313370b38ef355acdadcd122975b'
  );
  return g;
}

function expandMsg(domain: Uint8Array, msg: Uint8Array, outLen: number): Uint8Array {
  if (domain.length > 32) {
    throw new Error('bad domain size');
  }

  const out = new Uint8Array(outLen);

  const len0 = 64 + msg.length + 2 + 1 + domain.length + 1;
  const in0 = new Uint8Array(len0);
  let off = 64;
  in0.set(msg, off); off += msg.length;
  in0.set([(outLen >> 8) & 0xff, outLen & 0xff], off); off += 2;
  in0.set([0], off); off += 1;
  in0.set(domain, off); off += domain.length;
  in0.set([domain.length], off);

  const b0 = ethers.sha256(in0);

  const len1 = 32 + 1 + domain.length + 1;
  const in1 = new Uint8Array(len1);
  in1.set(ethers.getBytes(b0), 0);
  off = 32;
  in1.set([1], off); off += 1;
  in1.set(domain, off); off += domain.length;
  in1.set([domain.length], off);

  let bi = ethers.sha256(in1);
  const ell = Math.floor((outLen + 31) / 32);

  for (let i = 1; i < ell; i++) {
    const ini = new Uint8Array(32 + 1 + domain.length + 1);
    const nb0 = bytes32ArrayZeroPadding(ethers.getBytes(b0));
    const nbi = bytes32ArrayZeroPadding(ethers.getBytes(bi));
    const xor = new Uint8Array(32);
    for (let j = 0; j < 32; j++) xor[j] = nb0[j] ^ nbi[j];

    ini.set(xor, 0);
    let off = 32;
    ini.set([1 + i], off); off += 1;
    ini.set(domain, off); off += domain.length;
    ini.set([domain.length], off);

    out.set(ethers.getBytes(bi), 32 * (i - 1));
    bi = ethers.sha256(ini);
  }

  out.set(ethers.getBytes(bi), 32 * (ell - 1));
  return out;
}

function bytes32ArrayZeroPadding(array: Uint8Array): Uint8Array {
  const result = new Uint8Array(32);
  const start = 32 - array.length;
  for (let i = 0; i < array.length; i++) {
    result[start + i] = array[i];
  }
  return result;
}

function domain(): Uint8Array {
  return ethers.getBytes(
    ethers.solidityPackedKeccak256(['string'], ['TasksManager'])
  );
}
