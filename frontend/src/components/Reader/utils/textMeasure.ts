// 中文避头尾规则
// 不能出现在行首的字符（句号、逗号、问号等标点）
const cannotStartChars = new Set([
  '，', '。', '、', '；', '：', '？', '！', '…', '—', '～',
  '’', '”', '）', '』', '】', '］', '〕', '》',
]);

// 不能出现在行尾的字符（左引号、左括号等）
const cannotEndChars = new Set([
  '“', '‘', '（', '【', '［', '〔', '『', '「', '《',
]);

// 检查是否可以在当前字符前断行（即当前字符能否在行首）
export function canBreakBefore(char: string): boolean {
  return !cannotStartChars.has(char);
}

// 检查是否可以在当前字符后断行（即当前字符能否在行尾）
export function canBreakAfter(char: string): boolean {
  return !cannotEndChars.has(char);
}

export class TextMeasurer {
  private canvas: OffscreenCanvas;
  private ctx: OffscreenCanvasRenderingContext2D;

  constructor() {
    this.canvas = new OffscreenCanvas(2000, 100);
    this.ctx = this.canvas.getContext('2d')!;
  }

  measureWidth(text: string, fontSize: number, fontFamily: string): number {
    this.ctx.font = `${fontSize}px ${fontFamily}`;
    const metrics = this.ctx.measureText(text);
    return metrics.width;
  }

  // 使用二分查找找到当前宽度能容纳多少字符
  fitTextToWidth(
    text: string,
    maxWidth: number,
    fontSize: number,
    fontFamily: string
  ): number {
    if (text.length === 0) return 0;

    // 快速检查：整个文本都放不下？
    const fullWidth = this.measureWidth(text, fontSize, fontFamily);
    if (fullWidth <= maxWidth) {
      return text.length;
    }

    let low = 0;
    let high = text.length;
    let best = 0;

    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      const width = this.measureWidth(text.slice(0, mid), fontSize, fontFamily);
      if (width <= maxWidth) {
        best = mid;
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }

    // 调整断点遵守避头尾规则
    if (best < text.length) {
      // 如果当前断点后的字符不能在行首，向前移动
      let adjusted = best;
      while (adjusted > 0 && !canBreakBefore(text[adjusted])) {
        adjusted--;
      }
      // 如果调整后变成 0，说明当前行必须只有这个字符，只能让它在行首了
      if (adjusted > 0) {
        best = adjusted;
      }

      // 检查当前最后一个字符是否不能在行尾
      if (best > 0 && !canBreakAfter(text[best - 1])) {
        best--;
      }
    }

    // 至少要返回一个字符
    return best > 0 ? best : 1;
  }
}
