import { EditorView } from "@codemirror/view";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { tags as t } from "@lezer/highlight";

const bg = "#0b1226";
const fg = "#e9f1ff";
const dim = "#3a4a75";
const muted = "#6a7494";
const pink = "#ff9bb3";
const yellow = "#ffd86b";
const water = "#5cc9ff";
const mint = "#a8f0c5";
const punct = "#8a9bc5";

const editorTheme = EditorView.theme(
  {
    "&": {
      color: fg,
      backgroundColor: "transparent",
      fontFamily: "var(--font-mono)",
      fontSize: "14px",
      height: "100%",
    },
    ".cm-content": {
      caretColor: water,
      padding: "16px 0",
    },
    ".cm-cursor, .cm-dropCursor": {
      borderLeftColor: water,
    },
    "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection":
      {
        backgroundColor: "rgba(92, 201, 255, 0.18)",
      },
    ".cm-activeLine": {
      backgroundColor: "rgba(92, 201, 255, 0.04)",
    },
    ".cm-activeLineGutter": {
      backgroundColor: "rgba(92, 201, 255, 0.04)",
      color: water,
    },
    ".cm-gutters": {
      backgroundColor: "transparent",
      color: dim,
      border: "none",
      paddingRight: "12px",
    },
    ".cm-lineNumbers .cm-gutterElement": {
      color: dim,
      padding: "0 8px 0 16px",
      minWidth: "36px",
      textAlign: "right",
    },
    ".cm-foldPlaceholder": {
      backgroundColor: "transparent",
      color: muted,
      border: "none",
    },
    ".cm-matchingBracket": {
      backgroundColor: "rgba(168, 240, 197, 0.18)",
      color: mint,
    },
    ".cm-tooltip": {
      backgroundColor: "#131b35",
      border: "1px solid #1f2b55",
      color: fg,
    },
    ".cm-tooltip-autocomplete > ul > li[aria-selected]": {
      backgroundColor: "rgba(92, 201, 255, 0.15)",
      color: fg,
    },
  },
  { dark: true },
);

const highlight = HighlightStyle.define([
  { tag: [t.comment, t.lineComment, t.blockComment], color: muted, fontStyle: "italic" },
  { tag: t.docComment, color: muted, fontStyle: "italic" },

  {
    tag: [
      t.keyword,
      t.controlKeyword,
      t.moduleKeyword,
      t.definitionKeyword,
      t.operatorKeyword,
    ],
    color: pink,
  },
  { tag: [t.bool, t.atom, t.null], color: pink },

  { tag: [t.string, t.special(t.string), t.regexp], color: yellow },
  { tag: t.number, color: yellow },

  { tag: t.function(t.variableName), color: water },
  { tag: t.function(t.definition(t.variableName)), color: water },
  { tag: t.definition(t.variableName), color: fg },
  { tag: t.variableName, color: fg },

  { tag: [t.typeName, t.className, t.namespace], color: mint },
  { tag: t.tagName, color: mint },
  { tag: t.attributeName, color: yellow },
  { tag: t.attributeValue, color: yellow },

  { tag: t.propertyName, color: water },
  { tag: t.labelName, color: water },

  { tag: [t.punctuation, t.separator, t.bracket, t.brace, t.paren], color: punct },
  { tag: t.angleBracket, color: punct },

  { tag: t.operator, color: pink },
  { tag: t.meta, color: muted },
  { tag: t.invalid, color: "#ff6b6b" },
]);

export const druplOcean = [editorTheme, syntaxHighlighting(highlight)];
