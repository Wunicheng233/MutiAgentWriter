import React, { useEffect, useMemo, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Layout } from '../../components/Layout';
import { Link } from 'react-router-dom';
import { Button } from '../../components/v2';
import { getProject, getChapter, listChapters } from '../../utils/endpoints';
import { useReaderStore } from './stores/readerStore';
import { ReaderCore } from './ReaderCore';
import { EditorCore } from './EditorCore';
import { ReaderMenu } from './components/ReaderMenu';
import { ReaderSettings } from './components/ReaderSettings';
import { TableOfContents } from './components/TableOfContents';
import { BookmarkPanel } from './components/BookmarkPanel';
import { SearchPanel } from './components/SearchPanel';
import { useReaderSettings } from './hooks/useReaderSettings';
import { useContentSync } from './hooks/useContentSync';
import { updateChapter } from '../../utils/endpoints';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '../../components/toastContext';
import type { PaginationResponse } from './types';

const Reader: React.FC = () => {
  const { id, chapterIndex } = useParams<{ id: string; chapterIndex: string }>();
  const projectId = id ? parseInt(id) : 0;
  const currentChapterIndex = chapterIndex ? parseInt(chapterIndex) : 0;
  const queryClient = useQueryClient();

  // 参数校验 - 无效参数时在 hooks 外部检查，避免条件调用
  const isValidProjectId = !Number.isNaN(projectId) && projectId > 0;
  const isValidChapterIndex = !Number.isNaN(currentChapterIndex);
  const { showToast } = useToast();

  // Store state
  const mode = useReaderStore(state => state.mode);
  const setMode = useReaderStore(state => state.setMode);
  const setCurrentChapter = useReaderStore(state => state.setCurrentChapter);
  const { applySettings, themeClass } = useReaderSettings();

  // Fetch data - 仅在参数有效时查询
  const { data: project } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => getProject(projectId),
    enabled: isValidProjectId,
  });

  const { data: chapters = [] } = useQuery({
    queryKey: ['project-chapters', projectId],
    queryFn: () => listChapters(projectId),
    enabled: isValidProjectId,
  });

  const { data: chapter, isLoading } = useQuery({
    queryKey: ['chapter', projectId, currentChapterIndex],
    queryFn: () => getChapter(projectId, currentChapterIndex),
    enabled: isValidProjectId && isValidChapterIndex,
  });

  // Content sync between modes
  const { content, setContent, setIsDirty, restoreReadingPosition } =
    useContentSync(chapter?.content || '');

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: (newContent: string) =>
      updateChapter(projectId, currentChapterIndex, { content: newContent }),
    onSuccess: () => {
      showToast('已保存', 'success');
      setIsDirty(false);
      queryClient.invalidateQueries({ queryKey: ['chapter', projectId, currentChapterIndex] });
    },
    onError: () => {
      showToast('保存失败', 'error');
    },
  });

  // Initialize
  useEffect(() => {
    setCurrentChapter(currentChapterIndex);
    applySettings();
  }, [currentChapterIndex, setCurrentChapter, applySettings]);

  // Handle save and return to read mode
  const handleSaveAndExit = () => {
    updateMutation.mutate(content);
    setMode('read');
    // Content changed, will re-paginate when back to read mode
  };

  // Handle cancel edit
  const handleCancel = () => {
    setContent(chapter?.content || '');
    setIsDirty(false);
    setMode('read');
    restoreReadingPosition();
  };

  // 保存分页 pages 引用，用于搜索跳转
  const pagesRef = useRef<PaginationResponse['pages']>([]);

  // Jump to bookmark/position
  // bookmark: position is page number
  // search: position is character offset, find page by offset
  const handleJumpToPosition = (position: number) => {
    const pages = pagesRef.current;
    if (pages.length === 0) {
      useReaderStore.getState().setCurrentPage(position);
      return;
    }

    // 检查是否是页码（书签）还是字符 offset（搜索）
    // 如果 position 小于等于总页数，说明是页码
    if (position <= pages.length) {
      useReaderStore.getState().setCurrentPage(position);
    } else {
      // 字符 offset，找到包含该位置的页
      for (let i = 0; i < pages.length; i++) {
        const page = pages[i];
        if (position >= page.startOffset && position < page.endOffset) {
          useReaderStore.getState().setCurrentPage(i + 1);
          break;
        }
      }
    }
  };

  // 更新 pages 引用 - 由 ReaderCore 调用
  const setPagesRef = (pages: PaginationResponse['pages']) => {
    pagesRef.current = pages;
  };

  const sortedChapters = useMemo(() => {
    return [...chapters].sort((a, b) => a.chapter_index - b.chapter_index);
  }, [chapters]);
  const currentChapterPosition = sortedChapters.findIndex(
    item => item.chapter_index === currentChapterIndex
  );
  const previousChapter = currentChapterPosition > 0
    ? sortedChapters[currentChapterPosition - 1]
    : null;
  const nextChapter =
    currentChapterPosition >= 0 && currentChapterPosition < sortedChapters.length - 1
      ? sortedChapters[currentChapterPosition + 1]
      : null;
  const chapterProgressLabel = currentChapterPosition >= 0
    ? `${currentChapterPosition + 1} / ${sortedChapters.length}`
    : `${currentChapterIndex} / ${sortedChapters.length}`;

  if (isLoading || !project) {
    return (
      <Layout>
        <p className="text-[var(--text-secondary)]">加载中...</p>
      </Layout>
    );
  }

  if (!chapter) {
    return (
      <Layout>
        <p className="text-[var(--text-secondary)]">章节不存在</p>
      </Layout>
    );
  }

  // 无效参数显示错误
  if (!isValidProjectId || !isValidChapterIndex) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[50vh]">
          <div className="text-center">
            <h2 className="text-xl font-semibold mb-2">参数错误</h2>
            <p className="text-gray-500">项目ID或章节索引无效，请检查URL</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className={`!p-0 min-h-screen ${themeClass} bg-[var(--reader-bg)] text-[var(--reader-text)]`}>
      {/* 顶部导航栏 */}
      <header className="sticky top-0 z-30 bg-[var(--reader-bg)]/80 backdrop-blur border-b border-[var(--reader-border)] py-4 px-6">
        <div className="max-w-[1200px] mx-auto">
          <div className="flex justify-between items-center mb-3">
            <div>
              <h1 className="text-xl font-serif text-[var(--reader-text)]">
                {chapter.title || `第${currentChapterIndex}章`}
              </h1>
              <p className="text-sm text-[var(--reader-secondary)]">{project.name}</p>
            </div>
            <div className="flex gap-2">
              {mode === 'read' && (
                <Link to={`/projects/${id}/editor/${chapterIndex}`}>
                  <Button variant="secondary" size="sm">
                    编辑
                  </Button>
                </Link>
              )}
              <Link to={`/projects/${id}/chapters`}>
                <Button variant="secondary" size="sm">
                  章节
                </Button>
              </Link>
            </div>
          </div>
          {/* 上一章/下一章导航 */}
          {sortedChapters.length > 1 && (
            <div className="flex justify-center gap-4 pt-2 border-t border-[var(--reader-border)]/30">
              {previousChapter ? (
                <Link to={`/projects/${id}/read/${previousChapter.chapter_index}`}>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="px-6"
                  >
                    上一章
                  </Button>
                </Link>
              ) : (
                <Button
                  variant="secondary"
                  size="sm"
                  disabled
                  className="px-6"
                >
                  上一章
                </Button>
              )}
              <span className="flex items-center text-sm text-[var(--reader-secondary)]">
                {chapterProgressLabel}
              </span>
              {nextChapter ? (
                <Link to={`/projects/${id}/read/${nextChapter.chapter_index}`}>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="px-6"
                  >
                    下一章
                  </Button>
                </Link>
              ) : (
                <Button
                  variant="secondary"
                  size="sm"
                  disabled
                  className="px-6"
                >
                  下一章
                </Button>
              )}
            </div>
          )}
        </div>
      </header>

      {/* 主内容 */}
      <main>
        {mode === 'read' ? (
          <ReaderCore
            content={content}
            projectId={projectId}
            chapterIndex={currentChapterIndex}
            isShare={false}
            onPagesChange={setPagesRef}
          />
        ) : (
          <EditorCore
            content={content}
            onChange={setContent}
            onSave={handleSaveAndExit}
            onCancel={handleCancel}
            isSaving={updateMutation.isPending}
          />
        )}
      </main>

      {/* 浮动面板 */}
      <ReaderMenu projectId={projectId} chapterIndex={currentChapterIndex} />
      <ReaderSettings />
      <TableOfContents projectId={projectId} chapters={sortedChapters} />
      <BookmarkPanel
        projectId={projectId}
        chapterIndex={currentChapterIndex}
        onJump={(_chapterIdx, pos) => handleJumpToPosition(pos)}
      />
      <SearchPanel content={content} onJump={handleJumpToPosition} />

      </div>
    </Layout>
  );
};

export default Reader;
