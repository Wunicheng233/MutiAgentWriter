import React, { useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Layout } from '../../components/Layout';
import { Link } from 'react-router-dom';
import { Button } from '../../components/Button';
import { getProject, getChapter } from '../../utils/endpoints';
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
import { useToast } from '../../components/Toast';
import type { PaginationResponse } from './types';

const Reader: React.FC = () => {
  const { id, chapterIndex } = useParams<{ id: string; chapterIndex: string }>();
  const projectId = parseInt(id!);
  const currentChapterIndex = parseInt(chapterIndex!);
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  // Store state
  const mode = useReaderStore(state => state.mode);
  const setMode = useReaderStore(state => state.setMode);
  const setCurrentChapter = useReaderStore(state => state.setCurrentChapter);
  const { applySettings } = useReaderSettings();

  // Fetch data
  const { data: project } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => getProject(projectId),
  });

  const { data: chapter, isLoading } = useQuery({
    queryKey: ['chapter', projectId, currentChapterIndex],
    queryFn: () => getChapter(projectId, currentChapterIndex),
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

  if (isLoading || !project) {
    return (
      <Layout>
        <p className="text-secondary">加载中...</p>
      </Layout>
    );
  }

  if (!chapter) {
    return (
      <Layout>
        <p className="text-secondary">章节不存在</p>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="!p-0">
      {/* 顶部导航栏 */}
      <header className="sticky top-0 z-30 bg-[var(--reader-bg)]/80 backdrop-blur border-b border-[var(--reader-border)] py-4 px-6">
        <div className="max-w-[1200px] mx-auto flex justify-between items-center">
          <div>
            <h1 className="text-xl font-serif text-[var(--reader-text)]">
              {chapter.title || `第${currentChapterIndex}章`}
            </h1>
            <p className="text-sm text-[var(--reader-secondary)]">{project.name}</p>
          </div>
          <div className="flex gap-2">
            {mode === 'read' && (
              <Link to={`/projects/${id}/write/${chapterIndex}`}>
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
      {project && <TableOfContents project={project} projectId={projectId} />}
      <BookmarkPanel
        projectId={projectId}
        chapterIndex={currentChapterIndex}
        onJump={(_chapterIdx, pos) => handleJumpToPosition(pos)}
      />
      <SearchPanel content={content} onJump={handleJumpToPosition} />

      {/* 章节间导航 */}
      {project.chapters && project.chapters.length > 1 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-black/70 backdrop-blur-sm px-6 py-3 rounded-full flex items-center gap-4 z-30">
          <Link to={`/projects/${id}/read/${currentChapterIndex - 1}`}>
            <Button
              variant="secondary"
              size="sm"
              disabled={currentChapterIndex <= 1}
              className="text-white bg-transparent border-white/30 hover:bg-white/10 disabled:opacity-30"
            >
              上一章
            </Button>
          </Link>
          <span className="text-sm text-white">
            {currentChapterIndex} / {project.chapters.length}
          </span>
          <Link to={`/projects/${id}/read/${currentChapterIndex + 1}`}>
            <Button
              variant="secondary"
              size="sm"
              disabled={currentChapterIndex >= project.chapters.length}
              className="text-white bg-transparent border-white/30 hover:bg-white/10 disabled:opacity-30"
            >
              下一章
            </Button>
          </Link>
        </div>
      )}
      </div>
    </Layout>
  );
};

export default Reader;
