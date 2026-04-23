import React, { useEffect, useCallback, useRef } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { useReaderSettings } from './hooks/useReaderSettings';
import { EditorToolbar } from './components/EditorToolbar';

interface EditorCoreProps {
  content: string;
  onChange: (content: string) => void;
  onSave: () => void;
  onCancel: () => void;
  isSaving: boolean;
}

// 将纯文本转换为 HTML 段落（和 Editor.tsx 保持一致）
const convertPlainTextToHtml = (text: string): string => {
  if (!text) return '';
  const lines = text.split('\n')
    .map(line => line.trim())
    .filter(line => line !== '');
  return lines
    .map(line => `<p>${line}</p>`)
    .join('');
};

export const EditorCore: React.FC<EditorCoreProps> = ({
  content,
  onChange,
  onSave,
  onCancel,
  isSaving,
}) => {
  const { actualFontSize, actualLineHeight, actualMargin, themeClass } = useReaderSettings();
  const timeoutRef = useRef<number | null>(null);

  // 防抖自动保存
  const debouncedOnChange = useCallback((html: string) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = window.setTimeout(() => {
      onChange(html);
    }, 500);
  }, [onChange]);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
      }),
      Placeholder.configure({
        placeholder: '开始写作...',
      }),
    ],
    content: convertPlainTextToHtml(content),
    onUpdate: ({ editor }) => {
      debouncedOnChange(editor.getHTML());
    },
    immediatelyRender: false,
  });

  // 当 content 从外部变化时更新编辑器
  useEffect(() => {
    if (!editor || !content) return;
    const currentContent = editor.getHTML();
    // 只有当内容真正不同时才更新，避免光标跳动
    if (currentContent !== convertPlainTextToHtml(content)) {
      editor.commands.setContent(convertPlainTextToHtml(content));
    }
  }, [editor, content]);

  // 清理超时
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return (
    <div className={`min-h-screen ${themeClass} bg-[var(--reader-bg)] transition-colors duration-300 pb-20`}
      style={{
        '--reader-font-size': `${actualFontSize}px`,
        '--reader-line-height': actualLineHeight,
      } as React.CSSProperties}
    >
      <div className={`py-8 px-[${actualMargin}] mx-auto max-w-[720px]`}>
        <div className="bg-[var(--reader-bg)] border border-[var(--reader-border)] rounded-standard min-h-[calc(100vh-200px)] overflow-y-auto">
          {editor && (
            <EditorContent
              editor={editor}
              className="prose-novel max-w-canvas mx-auto px-8 pt-0 pb-8 focus:outline-none text-[var(--reader-text)]"
            />
          )}
        </div>
      </div>
      <EditorToolbar
        onSave={onSave}
        onCancel={onCancel}
        isSaving={isSaving}
      />
    </div>
  );
};

export default EditorCore;
