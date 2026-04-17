/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // 从 DESIGN.md 映射
        parchment: '#faf7f2',        // Warm Parchment 背景
        inkwell: '#3a2c1f',          // Inkwell Brown 标题深色
        sage: '#5b7f6e',             // Sage Green 主色
        terracotta: '#c06b4e',        // Terracotta 强调色
        'faded-rose': '#a8685c',     // Faded Rose 辅助色
        'muted-gold': '#a38b5a',      // Muted Gold
        body: '#4a3f35',             // Body text 正文
        secondary: '#7a6f62',         // Secondary text 次要文字
        muted: '#a69a8d',            // Muted text 占位/禁用
        border: '#e8ddd0',           // Divider/border 分隔线
      },
      fontFamily: {
        serif: ['"Crimson Pro"', 'Georgia', 'serif'],
        sans: ['"Inter"', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'SF Mono', 'monospace'],
      },
      boxShadow: {
        'ambient': '0px 4px 12px rgba(60, 40, 20, 0.04)',
        'standard': '0px 8px 20px rgba(60, 40, 20, 0.06)',
        'elevated': '0px 16px 32px rgba(60, 40, 20, 0.10)',
        'modal': '0px 24px 48px rgba(60, 40, 20, 0.14)',
      },
      borderRadius: {
        'micro': '4px',
        'standard': '12px',
        'comfortable': '16px',
        'large': '24px',
        'pill': '9999px',
      },
      spacing: {
        // 遵循 8px 基准
        '1': '4px',
        '2': '8px',
        '3': '12px',
        '4': '16px',
        '5': '20px',
        '6': '24px',
        '8': '32px',
        '10': '40px',
        '12': '48px',
        '16': '64px',
        '20': '80px',
        '24': '96px',
      },
      maxWidth: {
        'content': '1280px',
        'canvas': '720px',
        'sidebar': '320px',
      },
    },
  },
  plugins: [],
}
