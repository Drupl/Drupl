import { Parser, Language, type Node } from "web-tree-sitter";
import treeSitterWasm from "web-tree-sitter/web-tree-sitter.wasm?url";
import jsWasm from "tree-sitter-wasms/out/tree-sitter-javascript.wasm?url";
import tsWasm from "tree-sitter-wasms/out/tree-sitter-typescript.wasm?url";
import tsxWasm from "tree-sitter-wasms/out/tree-sitter-tsx.wasm?url";
import jsonWasm from "tree-sitter-wasms/out/tree-sitter-json.wasm?url";
import cssWasm from "tree-sitter-wasms/out/tree-sitter-css.wasm?url";
import htmlWasm from "tree-sitter-wasms/out/tree-sitter-html.wasm?url";
import pythonWasm from "tree-sitter-wasms/out/tree-sitter-python.wasm?url";
import rustWasm from "tree-sitter-wasms/out/tree-sitter-rust.wasm?url";
import bashWasm from "tree-sitter-wasms/out/tree-sitter-bash.wasm?url";

const GRAMMARS: Record<string, string> = {
  javascript: jsWasm,
  typescript: tsWasm,
  tsx: tsxWasm,
  json: jsonWasm,
  css: cssWasm,
  html: htmlWasm,
  python: pythonWasm,
  rust: rustWasm,
  bash: bashWasm,
};

let parserInit: Promise<void> | null = null;
function ensureInit(): Promise<void> {
  if (!parserInit) {
    parserInit = Parser.init({
      locateFile: () => treeSitterWasm,
    });
  }
  return parserInit;
}

const langCache = new Map<string, Promise<Language>>();
function getLang(key: string): Promise<Language> | null {
  const url = GRAMMARS[key];
  if (!url) return null;
  if (!langCache.has(key)) {
    langCache.set(key, Language.load(url));
  }
  return langCache.get(key)!;
}

export function langKeyFor(name: string): string | null {
  const ext = name.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "js":
    case "jsx":
    case "mjs":
    case "cjs":
      return "javascript";
    case "ts":
      return "typescript";
    case "tsx":
      return "tsx";
    case "json":
      return "json";
    case "css":
      return "css";
    case "html":
    case "htm":
      return "html";
    case "py":
      return "python";
    case "rs":
      return "rust";
    case "sh":
    case "bash":
    case "zsh":
      return "bash";
    default:
      return null;
  }
}

export type SymbolKind =
  | "function"
  | "method"
  | "class"
  | "struct"
  | "enum"
  | "trait"
  | "interface"
  | "type"
  | "impl";

export type TsSymbol = {
  name: string;
  kind: SymbolKind;
  line: number;
  col: number;
  depth: number;
};

export type TsInfo = {
  language: string;
  nodeCount: number;
  parseMs: number;
  symbols: TsSymbol[];
};

const SYMBOL_NODES: Record<string, SymbolKind> = {
  // js/ts
  function_declaration: "function",
  function_expression: "function",
  arrow_function: "function",
  method_definition: "method",
  class_declaration: "class",
  generator_function_declaration: "function",
  type_alias_declaration: "type",
  interface_declaration: "interface",
  // python
  function_definition: "function",
  class_definition: "class",
  // rust
  function_item: "function",
  struct_item: "struct",
  enum_item: "enum",
  trait_item: "trait",
  impl_item: "impl",
  type_item: "type",
};

const NAME_FIELDS = ["name", "identifier"];
const NAME_CHILD_TYPES = [
  "identifier",
  "type_identifier",
  "property_identifier",
  "field_identifier",
];

function findName(node: Node): string | null {
  for (const field of NAME_FIELDS) {
    const child = node.childForFieldName(field);
    if (child) return child.text;
  }
  for (let i = 0; i < node.childCount; i++) {
    const child = node.child(i);
    if (!child) continue;
    if (NAME_CHILD_TYPES.includes(child.type)) return child.text;
  }
  return null;
}

function extractSymbols(root: Node): TsSymbol[] {
  const out: TsSymbol[] = [];
  function walk(node: Node, depth: number) {
    let nextDepth = depth;
    const kind = SYMBOL_NODES[node.type];
    if (kind) {
      let name = findName(node);
      if (!name && kind === "impl") {
        // rust impl: take the type identifier from children
        for (let i = 0; i < node.childCount; i++) {
          const c = node.child(i);
          if (c && (c.type === "type_identifier" || c.type === "generic_type")) {
            name = c.text;
            break;
          }
        }
      }
      if (!name && (node.type === "function_expression" || node.type === "arrow_function")) {
        // unnamed function expressions — skip (too noisy)
        name = null;
      }
      if (name) {
        out.push({
          name,
          kind,
          line: node.startPosition.row,
          col: node.startPosition.column,
          depth,
        });
        nextDepth = depth + 1;
      }
    }
    for (let i = 0; i < node.childCount; i++) {
      const c = node.child(i);
      if (c) walk(c, nextDepth);
    }
  }
  walk(root, 0);
  return out;
}

export async function parse(filename: string, content: string): Promise<TsInfo | null> {
  const key = langKeyFor(filename);
  if (!key) return null;
  await ensureInit();
  const lang = await getLang(key);
  if (!lang) return null;
  const parser = new Parser();
  parser.setLanguage(lang);
  const t0 = performance.now();
  const tree = parser.parse(content);
  const t1 = performance.now();
  if (!tree) {
    parser.delete();
    return null;
  }
  const nodeCount = tree.rootNode.descendantCount;
  const symbols = extractSymbols(tree.rootNode);
  tree.delete();
  parser.delete();
  return { language: key, nodeCount, parseMs: t1 - t0, symbols };
}
