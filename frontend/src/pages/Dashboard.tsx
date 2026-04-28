import React, { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Badge, Button, Progress, Modal, ModalHeader, ModalContent, ModalFooter, Empty, Skeleton, DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '../components/v2'
import type { BadgeVariant } from '../components/v2'
import { CanvasContainer } from '../components/layout/CanvasContainer'
import { listProjects, deleteProject, resetProject } from '../utils/endpoints'
import type { Project } from '../types/api'

export const Dashboard: React.FC = () => {
  const queryClient = useQueryClient()
  const { data, isLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: () => listProjects(),
  })

  // 删除确认弹窗
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  // 重置确认弹窗
  const [resetModalOpen, setResetModalOpen] = useState(false)
  const [projectToReset, setProjectToReset] = useState<Project | null>(null)
  const [isResetting, setIsResetting] = useState(false)

  const handleDeleteClick = (project: Project) => {
    setProjectToDelete(project)
    setDeleteModalOpen(true)
  }

  const handleConfirmDelete = async () => {
    if (!projectToDelete) return

    setIsDeleting(true)
    try {
      await deleteProject(projectToDelete.id)
      queryClient.invalidateQueries({ queryKey: ['projects'] })
      setDeleteModalOpen(false)
      setProjectToDelete(null)
    } catch (error) {
      console.error('删除项目失败:', error)
    } finally {
      setIsDeleting(false)
    }
  }

  const handleResetClick = (project: Project) => {
    setProjectToReset(project)
    setResetModalOpen(true)
  }

  const handleConfirmReset = async () => {
    if (!projectToReset) return

    setIsResetting(true)
    try {
      await resetProject(projectToReset.id)
      queryClient.invalidateQueries({ queryKey: ['projects'] })
      setResetModalOpen(false)
      setProjectToReset(null)
    } catch (error) {
      console.error('重置项目失败:', error)
    } finally {
      setIsResetting(false)
    }
  }

  const getStatusColor = (status: string): BadgeVariant => {
    switch (status) {
      case 'draft': return 'secondary'
      case 'generating': return 'warning'
      case 'completed': return 'success'
      case 'failed': return 'error'
      default: return 'secondary'
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'draft': return '草稿'
      case 'generating': return '生成中'
      case 'completed': return '已完成'
      case 'failed': return '失败'
      default: return status
    }
  }

  return (
    <CanvasContainer maxWidth={1200}>
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-serif text-[var(--text-primary)]">我的书架</h1>
        <Link to="/projects/new">
          <Button variant="primary">新建项目</Button>
        </Link>
      </div>

      {isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-32 rounded-lg" />
          ))}
        </div>
      )}

      {data && data.items.length === 0 && (
        <Empty
          icon="folder"
          title="还没有项目"
          description="创建第一个项目开始创作吧"
          action={
            <Link to="/projects/new">
              <Button variant="primary">创建新项目</Button>
            </Link>
          }
        />
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {data?.items.map((project: Project) => (
          <div key={project.id} className="relative group">
            <Link to={`/projects/${project.id}/overview`}>
              <div
                className="relative h-full rounded-[var(--radius-lg)] overflow-hidden transition-all duration-300 group-hover:-translate-y-1"
                style={{
                  boxShadow: '4px 4px 12px rgba(0,0,0,0.08), 1px 1px 4px rgba(0,0,0,0.04)',
                }}
              >
                {/* 主卡片 - 模拟书籍封面 */}
                <div className="relative h-full rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-gradient-to-br from-[var(--bg-secondary)] via-[var(--bg-secondary)] to-[var(--bg-primary)] overflow-hidden">
                  {/* 纸张纹理 - 细微噪点 */}
                  <div
                    className="absolute inset-0 opacity-[0.02] pointer-events-none mix-blend-multiply"
                    style={{
                      backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='4'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
                    }}
                  />

                  {/* 左侧书脊 - 使用主题色系渐变 */}
                  <div
                    className="absolute left-0 top-0 bottom-0 w-4"
                    style={{
                      background: `linear-gradient(to right, color-mix(in srgb, var(--accent-primary) 18%, transparent), color-mix(in srgb, var(--accent-primary) 8%, transparent), transparent)`,
                    }}
                  />

                  {/* 书脊高光 - 纸张边缘反光 */}
                  <div className="absolute left-[4px] top-0 bottom-0 w-px bg-gradient-to-b from-white/30 via-white/15 to-white/5" />

                  {/* 封面顶部光照 - 更宽更柔和 */}
                  <div className="absolute top-0 left-4 right-0 h-32 bg-gradient-to-b from-white/8 to-transparent" />

                  <div className="relative mb-3 px-5 pt-5">
                    <h3 className="text-xl font-serif text-[var(--text-primary)] leading-tight truncate whitespace-nowrap overflow-hidden">
                      {project.name}
                    </h3>
                    <div className="mt-2">
                      <Badge variant={getStatusColor(project.status)} className="whitespace-nowrap">
                        {getStatusText(project.status)}
                      </Badge>
                    </div>
                  </div>

                  {project.description && (
                    <p className="relative text-[var(--text-secondary)] text-sm mb-4 line-clamp-2 px-5">
                      {project.description}
                    </p>
                  )}

                  {project.overall_quality_score > 0 && (
                    <div className="relative mb-4 px-5">
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-[var(--text-secondary)]">总体质量</span>
                        <span className="text-[var(--text-primary)] font-medium">{project.overall_quality_score.toFixed(1)}/10</span>
                      </div>
                      <Progress
                        value={project.overall_quality_score * 10}
                        size="sm"
                      />
                    </div>
                  )}

                  <div className="relative text-xs text-[var(--text-muted)] mt-auto pt-4 px-5 pb-5 border-t border-[var(--border-default)] border-opacity-30">
                    更新于 {new Date(project.updated_at).toLocaleDateString()}
                  </div>
                </div>
              </div>
            </Link>

            {/* 项目管理下拉菜单 - hover 时显示 */}
            <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-all duration-150 z-10">
              <DropdownMenu>
                <DropdownMenuTrigger>
                  <button
                    className="p-2 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-all duration-150"
                    title="项目管理"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                      <circle cx="12" cy="5" r="2" />
                      <circle cx="12" cy="12" r="2" />
                      <circle cx="12" cy="19" r="2" />
                    </svg>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onSelect={() => handleResetClick(project)}>
                    <span className="flex items-center gap-2 text-[var(--text-body)]">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                        <path d="M3 3v5h5" />
                      </svg>
                      重置项目
                    </span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => handleDeleteClick(project)}>
                    <span className="flex items-center gap-2 text-[var(--accent-warm)]">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M3 6h18" />
                        <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                        <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                      </svg>
                      删除项目
                    </span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        ))}
      </div>

      {/* 删除确认弹窗 */}
      <Modal
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        size="sm"
        showCloseButton={false}
      >
        <ModalHeader>确认删除</ModalHeader>
        <ModalContent>
          <p className="text-[var(--text-body)]">
            确定要删除项目「<span className="font-medium text-[var(--text-primary)]">{projectToDelete?.name}</span>」吗？此操作不可恢复。
          </p>
        </ModalContent>
        <ModalFooter>
          <Button
            variant="secondary"
            onClick={() => setDeleteModalOpen(false)}
            disabled={isDeleting}
          >
            取消
          </Button>
          <Button
            variant="danger"
            onClick={handleConfirmDelete}
            loading={isDeleting}
          >
            删除
          </Button>
        </ModalFooter>
      </Modal>

      {/* 重置确认弹窗 */}
      <Modal
        isOpen={resetModalOpen}
        onClose={() => setResetModalOpen(false)}
        size="sm"
        showCloseButton={false}
      >
        <ModalHeader>确认重置</ModalHeader>
        <ModalContent>
          <p className="text-[var(--text-body)]">
            确定要重置项目「<span className="font-medium text-[var(--text-primary)]">{projectToReset?.name}</span>」吗？这会清除所有已生成的章节和任务记录，项目将回到草稿状态，此操作不可恢复。
          </p>
        </ModalContent>
        <ModalFooter>
          <Button
            variant="secondary"
            onClick={() => setResetModalOpen(false)}
            disabled={isResetting}
          >
            取消
          </Button>
          <Button
            variant="danger"
            onClick={handleConfirmReset}
            loading={isResetting}
          >
            重置
          </Button>
        </ModalFooter>
      </Modal>
    </CanvasContainer>
  )
}

export default Dashboard
