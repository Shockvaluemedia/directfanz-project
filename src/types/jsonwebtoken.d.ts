declare module 'jsonwebtoken' {
  export function sign(
    payload: string | Buffer | object,
    secretOrPrivateKey: string | Buffer,
    options?: any
  ): string;

  export function verify(
    token: string,
    secretOrPublicKey: string | Buffer,
    options?: any
  ): any;

  export function decode(
    token: string,
    options?: any
  ): any;
}
