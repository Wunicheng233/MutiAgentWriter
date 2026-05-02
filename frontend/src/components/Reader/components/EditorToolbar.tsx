import React, { useState, useEffect } from 'react';
import { Button } from '../../../components/v2';

interface EditorToolbarProps {
  onSave: () => void;
  onCancel: () => void;
  isSaving: boolean;
}

export const EditorToolbar: React.FC<EditorToolbarProps> = ({
  onSave,
  onCancel,
  isSaving,
}) => {
  const [visible, setVisible] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      if (currentScrollY > lastScrollY && currentScrollY > 50) {
        setVisible(false);
      } else {
        setVisible(true);
      }
      setLastScrollY(currentScrollY);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [lastScrollY]);

  return (
    <div
      className={`
        fixed bottom-0 left-0 right-0 bg-[var(--reader-surface)] backdrop-blur border-t border-[var(--reader-border)] z-40
        transition-transform duration-300 px-4 py-3
        ${visible ? 'translate-y-0' : 'translate-y-full'}
      `}
    >
      <div className="max-w-4xl mx-auto flex justify-between items-center">
        <div className="text-sm text-[var(--reader-secondary)]">
          {isSaving && <span>保存中...</span>}
          {!isSaving && <span>自动保存已开启</span>}
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={onCancel}>
            取消
          </Button>
          <Button variant="primary" onClick={onSave} disabled={isSaving}>
            完成编辑
          </Button>
        </div>
      </div>
    </div>
  );
};

export default EditorToolbar;
