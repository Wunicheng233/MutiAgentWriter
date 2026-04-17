import React, { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { getSharedProject, getSharedChapter } from '../utils/endpoints'

export const ShareView: React.FC = () => {
  const { token } = useParams<{ token: string }>()
  const [currentChapterIndex, setCurrentChapterIndex] = useState<number | null>(null)

  const { data: project, isLoading, error } = useQuery({
    queryKey: ['shared-project', token],
    queryFn: () => getSharedProject(token!),
  })

  const { data: chapter } = useQuery({
    queryKey: ['shared-chapter', token, currentChapterIndex],
    queryFn: () => currentChapterIndex ? getSharedChapter(token!, currentChapterIndex) : null,
    enabled: currentChapterIndex !== null,
  })

  if (isLoading) {
    return (
      <div className="min-h-screen bg-parchment flex items-center justify-center">
        <p className="text-secondary">加载中...</p>
      </div>
    )
  }

  if (error || !project) {
    return (
      <div className="min-h-screen bg-parchment flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-3xl text-inkwell mb-4">分享链接不存在</h1>
          <p className="text-secondary">该分享链接可能已过期或被删除</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-parchment">
      {/* 顶部标题栏 */}
      <header className="border-b border-border py-6 px-4 bg-white/60 backdrop-blur sticky top-0 z-10">
        <div className="max-w-5xl mx-auto">
          <h1 className="font-serif text-3xl text-inkwell text-center">{project.title}</h1>
          {project.description && (
            <p className="text-secondary text-center mt-2 max-w-2xl mx-auto">{project.description}</p>
          )}
          <p className="text-secondary text-center text-sm mt-2">作者：{project.author}</p>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-8">
          {/* 左侧目录 */}
          <aside className="lg:sticky lg:top-32 h-fit">
            <h2 className="font-serif text-xl text-inkwell mb-4">目录</h2>
            <div className="space-y-2">
              {project.chapters.map(chap => (
                <button
                  key={chap.chapter_index}
                  onClick={() => setCurrentChapterIndex(chap.chapter_index)}
                  className={`w-full text-left px-4 py-3 rounded-standard transition-colors ${
                    currentChapterIndex === chap.chapter_index
                      ? 'bg-sage/10 border border-sage text-inkwell'
                      : 'hover:bg-sage/5 border border-transparent text-body'
                  }`}
                >
                  {chap.title}
                </button>
              ))}
            </div>
          </aside>

          {/* 右侧内容 */}
          <main>
            {currentChapterIndex === null ? (
              <div className="text-center py-12 text-secondary">
                <p>请从左侧目录选择章节开始阅读</p>
              </div>
            ) : chapter ? (
              <article className="prose-novel max-w-none">
                <h2 className="font-serif text-2xl mb-6 text-center">{chapter.title}</h2>
                <div
                  className="font-serif text-[18px] leading-relaxed text-body"
                  dangerouslySetInnerHTML={{ __html: chapter.content }}
                />
                {project.chapters.length > currentChapterIndex && (
                  <div className="mt-12 text-center">
                    <button
                      onClick={() => setCurrentChapterIndex(currentChapterIndex + 1)}
                      className="px-6 py-3 bg-sage text-parchment rounded-full hover:bg-sage/90 transition-colors"
                    >
                      下一章
                    </button>
                  </div>
                )}
              </article>
            ) : (
              <p className="text-secondary">加载章节中...</p>
            )}
          </main>
        </div>
      </div>

      <footer className="border-t border-border py-6 mt-12">
        <p className="text-center text-secondary text-sm">
          使用 AI 多智能体创作系统生成 · StoryForge AI
        </p>
      </footer>
    </div>
  )
}

export default ShareView
