import { deflate, inflate } from "pako";
import { setFloat16, getFloat16 } from "fp16";

// --- Z85 (Base85 URL-safe) implementation ---
const Z85_CHARS = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ.-:+_^!/*?=<>()[]{}@|$#";
const Z85_VALUES = Object.fromEntries([...Z85_CHARS].map((c, i) => [c, i]));

// Encode Uint8Array -> Z85 string
function z85Encode(bytes) {
    if (bytes.length % 4 !== 0) throw new Error("Length must be multiple of 4");
    let out = "";
    for (let i = 0; i < bytes.length; i += 4) {
        // Force unsigned 32-bit
        let value =
            ((bytes[i] << 24) >>> 0) +
            ((bytes[i + 1] << 16) >>> 0) +
            ((bytes[i + 2] << 8) >>> 0) +
            (bytes[i + 3] >>> 0);

        for (let div = 85 ** 4; div >= 1; div /= 85) {
            out += Z85_CHARS[Math.floor(value / div) % 85];
        }
    }
    return out;
}

function z85Decode(str) {
    if (str.length % 5 !== 0) throw new Error("Length must be multiple of 5");
    const out = new Uint8Array((str.length / 5) * 4);
    let outIndex = 0;

    for (let i = 0; i < str.length; i += 5) {
        let value = 0 >>> 0;

        for (let j = 0; j < 5; j++) {
            value = (value * 85 + Z85_VALUES[str[i + j]]) >>> 0;
        }

        out[outIndex++] = (value >>> 24) & 0xff;
        out[outIndex++] = (value >>> 16) & 0xff;
        out[outIndex++] = (value >>> 8) & 0xff;
        out[outIndex++] = value & 0xff;
    }

    return out;
}

// --- Main encode ---
export function encodeFloatArray(float32Array) {
    // 1. Convert to float16 -> Uint16Array
    const buf = new ArrayBuffer(float32Array.length * 2);
    const view = new DataView(buf);
    for (let i = 0; i < float32Array.length; i++) {
        setFloat16(view, i * 2, float32Array[i], true); // little endian
    }
    const f16bytes = new Uint8Array(buf);

    // 2. Compress
    const compressed = deflate(f16bytes);

    // 3. Pad to multiple of 4
    let padded = compressed;
    if (compressed.length % 4 !== 0) {
        const pad = 4 - (compressed.length % 4);
        padded = new Uint8Array(compressed.length + pad);
        padded.set(compressed);
    }

    // 4. Encode to Z85
    return z85Encode(padded);
}

// --- Main decode ---
export function decodeFloatArray(encodedStr) {
    // 1. Z85 decode
    const bytes = z85Decode(encodedStr);

    // 2. Decompress
    const decompressed = inflate(bytes);

    // 3. Convert back to float32
    const view = new DataView(decompressed.buffer, decompressed.byteOffset, decompressed.byteLength);
    const f32 = new Float32Array(decompressed.byteLength / 2);
    for (let i = 0; i < f32.length; i++) {
        f32[i] = getFloat16(view, i * 2, true); // little endian
    }
    return f32;
}