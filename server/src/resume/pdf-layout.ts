import { type Font, type Ink, type Op, PAGE, textWidth, wrap } from "./pdf-writer";

export type Margins = { top: number; bottom: number; side: number };
type TextStyle = { font: Font; size: number; ink?: Ink; spacing?: number };

// lays text out top to bottom and stops at the page edge: one page, always, so the end may be cut
export class Layout {
  readonly ops: Op[] = [];
  truncated = false;
  readonly left: number;
  readonly right: number;
  readonly width: number;
  private y: number;

  constructor(private readonly margins: Margins) {
    this.left = margins.side;
    this.right = PAGE.width - margins.side;
    this.width = this.right - this.left;
    this.y = PAGE.height - margins.top;
  }

  fits(height: number) {
    if (this.y - height < this.margins.bottom) this.truncated = true;
    return !this.truncated;
  }

  // places one line at the current baseline without moving down
  place(text: string, style: TextStyle, x: number) {
    this.ops.push({ kind: "text", x, y: this.y - style.size, font: style.font, size: style.size, text, gray: style.ink, spacing: style.spacing });
  }

  measure(text: string, style: TextStyle) {
    return textWidth(text, style.font, style.size, style.spacing);
  }

  line(text: string, style: TextStyle, opts: { x?: number; advance?: number; center?: boolean } = {}) {
    if (!text || !this.fits(style.size)) return;
    const x = opts.center ? (PAGE.width - this.measure(text, style)) / 2 : (opts.x ?? this.left);
    this.place(text, style, x);
    this.down(opts.advance ?? style.size + 4);
  }

  paragraph(text: string, style: TextStyle, opts: { x?: number; width?: number; advance: number; center?: boolean }) {
    for (const piece of wrap(text, style.font, style.size, opts.width ?? this.width)) this.line(piece, style, opts);
  }

  bullets(items: string[], style: TextStyle, opts: { indent: number; rightPad?: number; advance: number }) {
    const width = this.width - opts.indent - (opts.rightPad ?? 0);
    for (const item of items) {
      wrap(item, style.font, style.size, width).forEach((piece, i) => {
        if (i === 0 && this.fits(style.size)) this.place("•", style, this.left + 2);
        this.line(piece, style, { x: this.left + opts.indent, advance: opts.advance });
      });
    }
  }

  // the rule hangs below the current line so a thick one never touches the text above it
  rule(ink: Ink, thickness: number) {
    this.ops.push({ kind: "rule", x: this.left, y: this.y - thickness, width: this.width, gray: ink, thickness });
  }

  down(height: number) {
    this.y -= height;
  }
}
