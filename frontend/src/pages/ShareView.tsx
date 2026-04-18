import React, { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getSharedProject, getSharedChapter } from '../utils/endpoints';
import { useReaderStore } from '../components/Reader/stores/readerStore';
import { ReaderCore } from '../components/Reader/ReaderCore';
import { ReaderMenu } from '../components/Reader/components/ReaderMenu';
import { ReaderSettings } from '../components/Reader/components/ReaderSettings';
import { TableOfContents } from '../components/Reader/components/TableOfContents';
import { BookmarkPanel } from '../components/Reader/components/BookmarkPanel';
import { SearchPanel } from '../components/Reader/components/SearchPanel';
import { useReaderSettings } from '../components/Reader/hooks/useReaderSettings';
import { Button } from '../components/Button';
import type { Project } from '../types/api';

export const ShareView: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const currentChapterIndex = useReaderStore((state) => state.currentChapterIndex);
  const setCurrentChapter = useReaderStore((state) => state.setCurrentChapter);
  const { settings, applySettings } = useReaderSettings();

  const { data: project, isLoading, error } = useQuery({
    queryKey: ['shared-project', token],
    queryFn: () => getSharedProject(token!),
  });

  const { data: chapter } = useQuery({
    queryKey: ['shared-chapter', token, currentChapterIndex],
    queryFn: () => currentChapterIndex !== null ? getSharedChapter(token!, currentChapterIndex) : null,
    enabled: currentChapterIndex !== null,
  });

  // Initialize
  useEffect(() => {
    if (project && project.chapters && project.chapters.length > 0) {
      setCurrentChapter(project.chapters[0].chapter_index);
    }
    applySettings();
  }, [project, setCurrentChapter, applySettings]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-parchment flex items-center justify-center">
        <p className="text-secondary">加载中...</p>
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="min-h-screen bg-parchment flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-3xl text-inkwell mb-4">分享链接不存在</h1>
          <p className="text-secondary">该分享链接可能已过期或被删除</p>
        </div>
      </div>
    );
  }

  // 转换为 Project 类型供 TableOfContents 使用
  const projectForToc: Project = {
    id: 0,
    user_id: 0,
    name: project.title,
    description: project.description || undefined,
    content_type: 'full_novel',
    status: 'completed',
    chapters: project.chapters.map(c => ({
      id: 0,
      project_id: 0,
      chapter_index: c.chapter_index,
      title: c.title,
      content: '',
      word_count: c.word_count,
      quality_score: 0,
      status: 'generated',
      created_at: '',
      updated_at: '',
    })),
    overall_quality_score: 0,
    created_at: '',
    updated_at: '',
  };

  return (
    <div className={`min-h-screen ${settings.theme} bg-[var(--reader-bg)]`}
      style={{
        // @ts-ignore
        '--reader-bg': 'var(--reader-bg)',
        '--reader-text': 'var(--reader-text)',
        '--reader-border': 'var(--reader-border)',
        '--reader-secondary': 'var(--reader-secondary)',
      } as React.CSSProperties}
    >
      {/* 顶部标题栏 */}
      <header className="border-b border-[var(--reader-border)] py-6 px-4 bg-white/60 backdrop-blur sticky top-0 z-10">
        <div className="max-w-5xl mx-auto">
          <h1 className="font-serif text-3xl text-[var(--reader-text)] text-center">{project.title}</h1>
          {project.description && (
            <p className="text-[var(--reader-secondary)] text-center mt-2 max-w-2xl mx-auto">{project.description}</p>
          )}
          <p className="text-[var(--reader-secondary)] text-center text-sm mt-2">作者：{project.author}</p>
        </div>
      </header>

      {/* 阅读内容 */}
      <main>
        {chapter && (
          <ReaderCore
            content={chapter.content}
            projectId={0}
            chapterIndex={currentChapterIndex}
            isShare={true}
          />
        )}
      </main>

      {/* 面板 - 分享模式只支持目录和设置，不支持编辑和进度保存 */}
      <ReaderMenu projectId={0} chapterIndex={currentChapterIndex} isShare={true} />
      <ReaderSettings />
      <TableOfContents project={projectForToc} projectId={0} />
      {/* 书签和搜索在分享模式也可用（保存在本地） */}
      <BookmarkPanel projectId={0} chapterIndex={currentChapterIndex} onJump={() => {}} />
      {chapter && <SearchPanel content={chapter.content} onJump={() => {}} />}

      {/* 章节间导航 */}
      {project.chapters && project.chapters.length > 1 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-black/70 backdrop-blur-sm px-6 py-3 rounded-full flex items-center gap-4 z-30">
          <Button
            variant="secondary"
            size="sm"
            disabled={currentChapterIndex <= 1}
            onClick={() => setCurrentChapter(currentChapterIndex - 1)}
            className="text-white bg-transparent border-white/30 hover:bg-white/10 disabled:opacity-30"
          >
            上一章
          </Button>
          <span className="text-sm text-white">
            {currentChapterIndex} / {project.chapters.length}
          </span>
          <Button
            variant="secondary"
            size="sm"
            disabled={currentChapterIndex >= project.chapters.length}
            onClick={() => setCurrentChapter(currentChapterIndex + 1)}
            className="text-white bg-transparent border-white/30 hover:bg-white/10 disabled:opacity-30"
          >
            下一章
          </Button>
        </div>
      )}

      <footer className="border-t border-[var(--reader-border)] py-6 mt-12">
        <p className="text-center text-[var(--reader-secondary)] text-sm">
          使用 AI 多智能体创作系统生成 · StoryForge AI
        </p>
      </footer>
    </div>
  );
};

export default ShareView;
