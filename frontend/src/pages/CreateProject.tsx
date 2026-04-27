import React, { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'

import { Card, Input, Textarea, Button, Progress, Divider, Alert } from '../components/v2'
import { createProject } from '../utils/endpoints'
import { useToast } from '../components/toastContext'
import { getErrorMessage } from '../utils/errorMessage'
import type { ProjectCreate } from '../types/api'

type ContentType = NonNullable<ProjectCreate['content_type']>

const steps = [
  { id: 1, title: '作品定位' },
  { id: 2, title: '创作 Brief' },
  { id: 3, title: '协作方式' },
  { id: 4, title: '确认创建' },
]

const contentTypes = [
  { value: 'full_novel', label: '长篇小说' },
  { value: 'short_story', label: '短篇小说' },
  { value: 'script', label: '剧本' },
]


function getModeLabel(formData: ProjectCreate): string {
  if (formData.skip_plan_confirmation && formData.skip_chapter_confirmation) {
    return '全自动生成'
  }
  if (!formData.skip_plan_confirmation && formData.skip_chapter_confirmation) {
    return '策划确认模式'
  }
  if (!formData.skip_plan_confirmation && !formData.skip_chapter_confirmation) {
    return '逐章共创模式'
  }
  return '章节接管模式'
}

export const CreateProject: React.FC = () => {
  const [currentStep, setCurrentStep] = useState(1)
  const navigate = useNavigate()
  const { showToast } = useToast()

  const [formData, setFormData] = useState<ProjectCreate>({
    name: '',
    description: '',
    content_type: 'full_novel',
    novel_name: '',
    novel_description: '',
    core_requirement: '',
    genre: '',
    total_words: 100000,
    core_hook: '',
    target_platform: '网络小说',
    chapter_word_count: 2000,
    start_chapter: 1,
    end_chapter: 10,
    skip_plan_confirmation: false,
    skip_chapter_confirmation: false,
    allow_plot_adjustment: false,
  })

  const updateForm = (partial: Partial<ProjectCreate>) => {
    setFormData(prev => ({ ...prev, ...partial }))
  }

  const { mutate, isPending } = useMutation({
    mutationFn: () => createProject(formData),
    onSuccess: data => {
      showToast('项目创建成功', 'success')
      navigate(`/projects/${data.id}/overview`)
    },
    onError: (error: unknown) => {
      showToast(getErrorMessage(error, '创建失败'), 'error')
    },
  })

  const progress = ((currentStep - 1) / (steps.length - 1)) * 100
  const currentStepMeta = steps[currentStep - 1]
  const selectedContentType = contentTypes.find(type => type.value === formData.content_type)

  let stepBlockedReason = ''
  if (currentStep === 1 && !formData.name?.trim()) {
    stepBlockedReason = '请输入项目名称'
  }
  if (currentStep === 2 && !formData.core_requirement?.trim()) {
    stepBlockedReason = '请输入核心创作需求'
  }
  if (currentStep === 3 && (formData.end_chapter ?? 1) < (formData.start_chapter ?? 1)) {
    stepBlockedReason = '结束章节不能小于起始章节'
  }

  const nextStep = () => {
    if (currentStep < steps.length && !stepBlockedReason) {
      setCurrentStep(currentStep + 1)
    }
  }

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1)
    }
  }

  const handleSubmit = () => {
    mutate()
  }

  return (
    
      <div className="mx-auto max-w-content space-y-6">
        <Card className="border-sage/20 bg-[linear-gradient(135deg,rgba(91,127,110,0.12),rgba(250,247,242,0.96),rgba(163,139,90,0.1))]">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="mb-4 flex flex-wrap items-center gap-3">
                <Link to="/">
                  <Button variant="secondary" size="sm">返回书架</Button>
                </Link>
                <span className="font-medium text-sm uppercase tracking-[0.24em] text-[var(--text-secondary)]">
                  Create Brief
                </span>
              </div>
              <h1 className="text-3xl md:text-4xl font-medium">新建创作项目</h1>
            </div>

            <div className="w-full max-w-md rounded-comfortable border border-white/70 bg-white/75 p-5 shadow-standard backdrop-blur">
              <p className="font-medium text-xs uppercase tracking-[0.24em] text-[var(--text-secondary)]">Current Step</p>
              <div className="mt-3 flex items-center justify-between">
                <h2 className="text-xl font-medium">{currentStepMeta.title}</h2>
                <span className="text-sm text-[var(--text-secondary)]">{currentStep} / {steps.length}</span>
              </div>
              <div className="mt-4">
                <Progress value={progress} />
              </div>
            </div>
          </div>
        </Card>

        <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <Card>
            <div className="mb-6 flex flex-wrap gap-3">
              {steps.map(step => (
                <button
                  key={step.id}
                  type="button"
                  onClick={() => setCurrentStep(step.id)}
                  className={`rounded-pill px-4 py-2 text-sm transition-colors ${
                    currentStep === step.id
                      ? 'bg-sage text-parchment'
                      : 'border border-border bg-parchment/60 text-[var(--text-secondary)] hover:border-sage/30 hover:text-inkwell'
                  }`}
                >
                  {step.id}. {step.title}
                </button>
              ))}
            </div>

            {currentStep === 1 && (
              <div className="space-y-5">
                <h2 className="text-2xl font-medium">作品定位</h2>

                <Input
                  label="项目名称"
                  placeholder="给你的作品起一个名字"
                  value={formData.name || ''}
                  onChange={event => updateForm({ name: event.target.value })}
                />

                <Textarea
                  label="项目简介"
                  placeholder="一句话说明这部作品"
                  value={formData.description || ''}
                  onChange={(event: React.ChangeEvent<HTMLTextAreaElement>) => updateForm({ description: event.target.value })}
                />

                <div className="space-y-3">
                  <label className="text-body text-sm font-medium">内容类型</label>
                  <div className="grid gap-3 md:grid-cols-3">
                    {contentTypes.map(type => (
                      <label
                        key={type.value}
                        className={`cursor-pointer rounded-comfortable border p-4 text-center transition-colors ${
                          formData.content_type === type.value
                            ? 'border-sage bg-sage/10 text-inkwell'
                            : 'border-border bg-parchment/40 text-[var(--text-secondary)] hover:border-sage/30'
                        }`}
                      >
                        <input
                          type="radio"
                          name="content_type"
                          value={type.value}
                          checked={formData.content_type === type.value}
                          onChange={(event: React.ChangeEvent<HTMLInputElement>) => updateForm({ content_type: event.target.value as ContentType })}
                          className="sr-only"
                        />
                        <div className="font-medium">{type.label}</div>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {currentStep === 2 && (
              <div className="space-y-5">
                <h2 className="text-2xl font-medium">创作 Brief</h2>

                <div className="grid gap-4 md:grid-cols-2">
                  <Input
                    label="小说名称"
                    placeholder="和项目名称相同也可以"
                    value={formData.novel_name || ''}
                    onChange={event => updateForm({ novel_name: event.target.value })}
                  />
                  <Input
                    label="小说题材"
                    placeholder="都市重生 / 玄幻穿越..."
                    value={formData.genre || ''}
                    onChange={event => updateForm({ genre: event.target.value })}
                  />
                </div>

                <Textarea
                  label="小说简介"
                  placeholder="介绍故事背景、主要人物关系"
                  value={formData.novel_description || ''}
                  onChange={(event: React.ChangeEvent<HTMLTextAreaElement>) => updateForm({ novel_description: event.target.value })}
                />

                <div className="grid gap-4 md:grid-cols-2">
                  <Input
                    label="目标总字数"
                    type="number"
                    placeholder="100000"
                    value={formData.total_words || ''}
                    onChange={(event: React.ChangeEvent<HTMLInputElement>) => updateForm({ total_words: parseInt(event.target.value, 10) || 0 })}
                  />
                  <Input
                    label="核心钩子"
                    placeholder="一句话说清它为什么抓人"
                    value={formData.core_hook || ''}
                    onChange={(event: React.ChangeEvent<HTMLInputElement>) => updateForm({ core_hook: event.target.value })}
                  />
                </div>

                <Textarea
                  label="核心创作需求"
                  placeholder="详细描述你想要的故事"
                  className="min-h-[180px]"
                  value={formData.core_requirement || ''}
                  onChange={(event: React.ChangeEvent<HTMLTextAreaElement>) => updateForm({ core_requirement: event.target.value })}
                />
              </div>
            )}

            {currentStep === 3 && (
              <div className="space-y-5">
                <h2 className="text-2xl font-medium">协作方式</h2>

                {(formData.end_chapter ?? 1) < (formData.start_chapter ?? 1) && (
                  <Alert variant="warning" title="章节范围冲突" className="mb-4">
                    结束章节不能小于起始章节，请检查输入
                  </Alert>
                )}

                <div className="grid gap-4 md:grid-cols-2">
                  <Input
                    label="目标发布平台"
                    placeholder="网络小说 / 出版..."
                    value={formData.target_platform || ''}
                    onChange={event => updateForm({ target_platform: event.target.value })}
                  />
                  <Input
                    label="每章字数"
                    type="number"
                    placeholder="2000"
                    value={formData.chapter_word_count || ''}
                    onChange={event => updateForm({ chapter_word_count: parseInt(event.target.value, 10) || 0 })}
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <Input
                    label="起始章节"
                    type="number"
                    placeholder="1"
                    value={formData.start_chapter || ''}
                    onChange={event => updateForm({ start_chapter: parseInt(event.target.value, 10) || 1 })}
                  />
                  <Input
                    label="结束章节"
                    type="number"
                    placeholder="10"
                    value={formData.end_chapter || ''}
                    onChange={event => updateForm({ end_chapter: parseInt(event.target.value, 10) || 1 })}
                  />
                </div>

                <div className="space-y-3 rounded-comfortable border border-border bg-parchment/50 p-4 text-sm">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="skip_plan_confirm"
                      checked={formData.skip_plan_confirmation}
                      onChange={event => updateForm({ skip_plan_confirmation: event.target.checked })}
                      className="rounded border-border text-sage focus:ring-sage"
                    />
                    <span>跳过策划方案人工确认</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="skip_chapter_confirm"
                      checked={formData.skip_chapter_confirmation}
                      onChange={event => updateForm({ skip_chapter_confirmation: event.target.checked })}
                      className="rounded border-border text-sage focus:ring-sage"
                    />
                    <span>跳过章节级人工确认</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="allow_plot_adjustment"
                      checked={formData.allow_plot_adjustment}
                      onChange={event => updateForm({ allow_plot_adjustment: event.target.checked })}
                      className="rounded border-border text-sage focus:ring-sage"
                    />
                    <span>允许每章后调整下一章剧情</span>
                  </label>
                </div>

                <div className="rounded-comfortable border border-sage/20 bg-sage/8 p-4">
                  <p className="font-medium text-xs uppercase tracking-[0.24em] text-[var(--text-secondary)]">Selected Mode</p>
                  <h3 className="mt-2 text-lg font-medium">{getModeLabel(formData)}</h3>
                </div>
              </div>
            )}

            {currentStep === 4 && (
              <div className="space-y-5">
                <h2 className="text-2xl font-medium">确认创建</h2>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-standard border border-border bg-parchment/60 p-4">
                    <p className="text-sm text-[var(--text-secondary)]">项目名称</p>
                    <p className="mt-1 font-medium">{formData.name || '未填写'}</p>
                  </div>
                  <div className="rounded-standard border border-border bg-parchment/60 p-4">
                    <p className="text-sm text-[var(--text-secondary)]">内容类型</p>
                    <p className="mt-1 font-medium">{selectedContentType?.label || '未选择'}</p>
                  </div>
                  <div className="rounded-standard border border-border bg-parchment/60 p-4">
                    <p className="text-sm text-[var(--text-secondary)]">章节范围</p>
                    <p className="mt-1 font-medium">{formData.start_chapter} - {formData.end_chapter}</p>
                  </div>
                  <div className="rounded-standard border border-border bg-parchment/60 p-4">
                    <p className="text-sm text-[var(--text-secondary)]">协作模式</p>
                    <p className="mt-1 font-medium">{getModeLabel(formData)}</p>
                  </div>
                </div>

                <div className="rounded-comfortable border border-border bg-white/70 p-4">
                  <p className="font-medium text-xs uppercase tracking-[0.24em] text-[var(--text-secondary)]">Core Requirement</p>
                  <div className="mt-3 space-y-2 text-sm">
                    <p><span className="text-[var(--text-secondary)]">小说名称：</span>{formData.novel_name || formData.name || '未填写'}</p>
                    <p><span className="text-[var(--text-secondary)]">题材：</span>{formData.genre || '未填写'}</p>
                    <p><span className="text-[var(--text-secondary)]">核心钩子：</span>{formData.core_hook || '未填写'}</p>
                    <p><span className="text-[var(--text-secondary)]">目标总字数：</span>{formData.total_words || '未填写'}</p>
                    <p><span className="text-[var(--text-secondary)]">发布平台：</span>{formData.target_platform || '未填写'}</p>
                    {formData.core_requirement && (
                      <div>
                        <p className="text-[var(--text-secondary)]">创作需求：</p>
                        <p className="mt-2 whitespace-pre-line">{formData.core_requirement}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            <Divider className="my-6" />
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <Button
                variant="secondary"
                onClick={prevStep}
                disabled={currentStep === 1 || isPending}
              >
                上一步
              </Button>

              <div className="flex flex-col items-end gap-2">
                {stepBlockedReason && currentStep < steps.length && (
                  <p className="text-sm text-[var(--text-secondary)]">{stepBlockedReason}</p>
                )}
                {currentStep < steps.length ? (
                  <Button variant="primary" onClick={nextStep} disabled={isPending || !!stepBlockedReason}>
                    下一步
                  </Button>
                ) : (
                  <Button variant="primary" onClick={handleSubmit} disabled={isPending}>
                    {isPending ? '创建中...' : '创建项目'}
                  </Button>
                )}
              </div>
            </div>
          </Card>

          <Card>
            <p className="font-medium text-xs uppercase tracking-[0.24em] text-[var(--text-secondary)]">Live Summary</p>

            <div className="mt-5 space-y-3">
              <div className="rounded-standard border border-border bg-parchment/60 p-4">
                <p className="text-sm text-[var(--text-secondary)]">作品名称</p>
                <p className="mt-1 font-medium">{formData.name || '-'}</p>
              </div>
              <div className="rounded-standard border border-border bg-parchment/60 p-4">
                <p className="text-sm text-[var(--text-secondary)]">内容类型</p>
                <p className="mt-1 font-medium">{selectedContentType?.label || '-'}</p>
              </div>
              <div className="rounded-standard border border-border bg-parchment/60 p-4">
                <p className="text-sm text-[var(--text-secondary)]">生成范围</p>
                <p className="mt-1 font-medium">
                  {formData.start_chapter} - {formData.end_chapter} 章
                </p>
              </div>
              <div className="rounded-standard border border-border bg-parchment/60 p-4">
                <p className="text-sm text-[var(--text-secondary)]">协作模式</p>
                <p className="mt-1 font-medium">{getModeLabel(formData)}</p>
              </div>
            </div>
          </Card>
        </div>
      </div>
    
  )
}

export default CreateProject
