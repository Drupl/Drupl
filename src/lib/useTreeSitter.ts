import { useEffect, useState } from "react";
import { parse, type TsInfo } from "./tree-sitter";

export function useTreeSitter(filename: string, content: string): TsInfo | null {
  const [info, setInfo] = useState<TsInfo | null>(null);

  useEffect(() => {
    let cancelled = false;
    const id = window.setTimeout(async () => {
      try {
        const result = await parse(filename, content);
        if (!cancelled) setInfo(result);
      } catch (err) {
        console.error("tree-sitter parse failed:", err);
        if (!cancelled) setInfo(null);
      }
    }, 200);
    return () => {
      cancelled = true;
      window.clearTimeout(id);
    };
  }, [filename, content]);

  return info;
}
