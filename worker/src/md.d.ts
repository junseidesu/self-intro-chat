// wrangler.toml の [[rules]] で .md をテキストとして同梱している
declare module "*.md" {
  const content: string;
  export default content;
}
