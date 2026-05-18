type Palette = Record<string, string>;

type Props = {
  data: string[];
  pixel?: number;
  palette: Palette;
};

export function PixelGrid({ data, pixel = 10, palette }: Props) {
  const rows = data.length;
  const cols = data[0].length;
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${cols}, ${pixel}px)`,
        gridTemplateRows: `repeat(${rows}, ${pixel}px)`,
        width: cols * pixel,
        height: rows * pixel,
        imageRendering: "pixelated",
      }}
    >
      {data.flatMap((row, y) =>
        [...row].map((ch, x) => (
          <div
            key={`${x}-${y}`}
            style={{ backgroundColor: palette[ch] || "transparent" }}
          />
        )),
      )}
    </div>
  );
}
