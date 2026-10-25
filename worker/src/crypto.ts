const encoder = new TextEncoder();
const decoder = new TextDecoder();

const toBase64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));
const fromBase64 = (text: string) => Uint8Array.from(atob(text), (c) => c.charCodeAt(0));

const keyFrom = async (hexKey: string) => {
  const raw = new Uint8Array((hexKey.match(/.{2}/gu) ?? []).map((pair) => Number.parseInt(pair, 16)));
  if (raw.length !== 32) throw new Error('TOKEN_ENC_KEY must be 64 hex characters');
  return crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']);
};

export const seal = async (hexKey: string, plain: string): Promise<string> => {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await keyFrom(hexKey), encoder.encode(plain)));
  return `${toBase64(iv)}.${toBase64(cipher)}`;
};

export const open = async (hexKey: string, sealed: string): Promise<string> => {
  const [iv, cipher] = sealed.split('.');
  if (iv === undefined || cipher === undefined) throw new Error('sealed value is malformed');
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromBase64(iv) }, await keyFrom(hexKey), fromBase64(cipher));
  return decoder.decode(plain);
};

export const randomHex = (bytes: number) =>
  [...crypto.getRandomValues(new Uint8Array(bytes))].map((b) => b.toString(16).padStart(2, '0')).join('');

export const sha256 = async (text: string): Promise<string> =>
  [...new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(text)))].map((b) => b.toString(16).padStart(2, '0')).join('');
