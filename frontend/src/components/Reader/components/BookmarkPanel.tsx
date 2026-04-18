import React from 'react';
import { useReaderStore } from '../stores/readerStore';
import { Button } from '../../../components/Button';
import Card from '../../../components/Card';

interface BookmarkPanelProps {
  projectId: number;
  chapterIndex: number;
  onJump: (chapterIndex: number, position: number) => void;
}

export const BookmarkPanel: React.FC<BookmarkPanelProps> = ({
  projectId,
  chapterIndex,
  onJump,
}) => {
  const isVisible = useReaderStore((state) => state.isBookmarkVisible);
  const setBookmarkVisible = useReaderStore((state) => state.setBookmarkVisible);
  const getBookmarks = useReaderStore((state) => state.getBookmarks);
  const removeBookmark = useReaderStore((state) => state.removeBookmark);

  if (!isVisible) return null;

  const bookmarks = getBookmarks(projectId, chapterIndex);

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      setBookmarkVisible(false);
    }
  };

  const handleJump = (bookmark: { chapterIndex: number; position: number }) => {
    onJump(bookmark.chapterIndex, bookmark.position);
    setBookmarkVisible(false);
  };

  const isMobile = window.innerWidth < 768;

  if (isMobile) {
    return (
      <div
        className="fixed inset-0 bg-black/50 z-50 flex items-end"
        onClick={handleBackdropClick}
      >
        <Card className="w-full max-h-[70vh] rounded-t-xl rounded-b-none p-4 bg-[var(--reader-bg)]">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-medium text-[var(--reader-text)]">我的书签</h3>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setBookmarkVisible(false)}
            >
              关闭
            </Button>
          </div>
          <div className="max-h-[calc(70vh-100px)] overflow-y-auto">
            {bookmarks.length === 0 ? (
              <p className="text-center text-[var(--reader-secondary)] py-8">
                暂无书签
              </p>
            ) : (
              <div className="space-y-2">
                {bookmarks.map(bookmark => (
                  <div
                    key={bookmark.id}
                    className="flex items-center justify-between p-3 border border-[var(--reader-border)] rounded-lg"
                  >
                    <div className="flex-1 cursor-pointer" onClick={() => handleJump(bookmark)}>
                      <div className="font-medium text-[var(--reader-text)]">
                        第{bookmark.chapterIndex}章 第{bookmark.position}页
                      </div>
                      <div className="text-xs text-[var(--reader-secondary)]">
                        {new Date(bookmark.createdAt).toLocaleString()}
                      </div>
                    </div>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => removeBookmark(projectId, chapterIndex, bookmark.id)}
                    >
                      删除
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
      onClick={handleBackdropClick}
    >
      <Card className="w-full max-w-md max-h-[70vh] bg-[var(--reader-bg)]">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-medium text-[var(--reader-text)]">我的书签</h3>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setBookmarkVisible(false)}
          >
            关闭
          </Button>
        </div>
        <div className="max-h-[calc(70vh-100px)] overflow-y-auto">
          {bookmarks.length === 0 ? (
            <p className="text-center text-[var(--reader-secondary)] py-8">
              暂无书签
            </p>
          ) : (
            <div className="space-y-2">
              {bookmarks.map(bookmark => (
                <div
                  key={bookmark.id}
                  className="flex items-center justify-between p-3 border border-[var(--reader-border)] rounded-lg"
                >
                  <div className="flex-1 cursor-pointer" onClick={() => handleJump(bookmark)}>
                    <div className="font-medium text-[var(--reader-text)]">
                      第{bookmark.chapterIndex}章 第{bookmark.position}页
                    </div>
                    <div className="text-xs text-[var(--reader-secondary)]">
                      {new Date(bookmark.createdAt).toLocaleString()}
                    </div>
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => removeBookmark(projectId, chapterIndex, bookmark.id)}
                  >
                    删除
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
};

export default BookmarkPanel;
