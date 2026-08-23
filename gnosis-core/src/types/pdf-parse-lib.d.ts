import type { Options, Result } from "pdf-parse"

declare module "pdf-parse/lib/pdf-parse.js" {
  const parse: (dataBuffer: Buffer, options?: Options) => Promise<Result>
  export default parse
}
