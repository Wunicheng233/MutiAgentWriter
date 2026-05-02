import React, { useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'

import { Card, Input, Textarea, Button, Progress, Divider, Alert, Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '../components/v2'
import SkillPicker from '../components/SkillPicker'
import { createProject, listSkills } from '../utils/endpoints'
import { extractAuthorNameParts } from '../utils/skillDisplay'
import { useToast } from '../components/toastContext'
import { getErrorMessage } from '../utils/errorMessage'
import type { EnabledSkillConfig, ProjectCreate } from '../types/api'

type ContentType = NonNullable<ProjectCreate['content_type']>

const steps = [
  { id: 1, title: '作品定位' },
  { id: 2, title: '创作 Brief' },
  { id: 3, title: '作家风格' },
  { id: 4, title: '协作方式' },
  { id: 5, title: '确认创建' },
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

function isPositiveNumber(value: unknown): boolean {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
}

function validateStep(stepId: number, formData: ProjectCreate): string {
  if (stepId === 1 && !formData.novel_name?.trim()) {
    return '请输入作品名称'
  }
  if (stepId === 2) {
    if (!formData.core_requirement?.trim()) {
      return '请输入核心创作需求'
    }
    if (formData.total_words !== undefined && !isPositiveNumber(formData.total_words)) {
      return '目标总字数必须大于 0'
    }
  }
  if (stepId === 4) {
    if (!isPositiveNumber(formData.chapter_word_count)) {
      return '每章字数必须大于 0'
    }
    if (!isPositiveNumber(formData.start_chapter) || !isPositiveNumber(formData.end_chapter)) {
      return '章节范围必须是正整数'
    }
    if ((formData.end_chapter ?? 1) < (formData.start_chapter ?? 1)) {
      return '结束章节不能小于起始章节'
    }
  }
  return ''
}

function getFirstInvalidStep(formData: ProjectCreate): { stepId: number; reason: string } | null {
  for (const step of steps) {
    const reason = validateStep(step.id, formData)
    if (reason) {
      return { stepId: step.id, reason }
    }
  }
  return null
}

function normalizeCreatePayload(formData: ProjectCreate): ProjectCreate {
  const workName = formData.novel_name?.trim() || formData.name?.trim() || ''
  const workDescription = formData.novel_description?.trim() || formData.description?.trim() || ''

  return {
    ...formData,
    name: workName,
    description: workDescription,
    novel_name: workName,
    novel_description: workDescription,
    core_requirement: formData.core_requirement?.trim() || '',
    genre: formData.genre?.trim() || '',
    core_hook: formData.core_hook?.trim() || '',
    target_platform: formData.target_platform?.trim() || '网络小说',
  }
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
  })

  const updateForm = (partial: Partial<ProjectCreate>) => {
    setFormData(prev => ({ ...prev, ...partial }))
  }

  const updateEnabledSkills = (enabled: EnabledSkillConfig[]) => {
    setFormData(prev => {
      const currentConfig = prev.config ?? {}
      return {
        ...prev,
        config: {
          ...currentConfig,
          skills: {
            ...(currentConfig.skills ?? {}),
            enabled,
          },
        },
      }
    })
  }

  const { data: skillsData, isLoading: isSkillsLoading } = useQuery({
    queryKey: ['skills'],
    queryFn: listSkills,
    staleTime: 1000 * 60 * 30,
  })

  const { mutate, isPending } = useMutation({
    mutationFn: () => createProject(normalizeCreatePayload(formData)),
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
  const workName = formData.novel_name?.trim()
  const workDescription = formData.novel_description?.trim()
  const skills = skillsData?.skills ?? []
  const enabledSkills = formData.config?.skills?.enabled ?? []
  const selectedSkillNames = enabledSkills.map(item => {
    const skill = skills.find(candidate => candidate.id === item.skill_id)
    if (!skill) return item.skill_id
    const { chinese } = extractAuthorNameParts(skill.name)
    return chinese
  })

  const firstInvalidStep = getFirstInvalidStep(formData)
  const maxReachableStep = firstInvalidStep?.stepId ?? steps.length
  const stepBlockedReason = validateStep(currentStep, formData)

  const nextStep = () => {
    if (currentStep < steps.length && !stepBlockedReason) {
      setCurrentStep(currentStep + 1)
    }
  }

  const goToStep = (stepId: number) => {
    setCurrentStep(Math.min(stepId, maxReachableStep))
  }

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1)
    }
  }

  const handleSubmit = () => {
    const invalidStep = getFirstInvalidStep(formData)
    if (invalidStep) {
      setCurrentStep(invalidStep.stepId)
      return
    }
    mutate()
  }

  return (
    
      <div className="mx-auto max-w-content space-y-6">
        <Card className="border-[rgba(var(--accent-primary-rgb),0.20)] bg-[linear-gradient(135deg,rgba(var(--accent-primary-rgb),0.12),var(--bg-primary),rgba(var(--accent-gold-rgb),0.10))]">
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

            <div className="w-full max-w-md rounded-comfortable border border-[var(--border-default)] bg-[var(--bg-secondary)] p-5 shadow-standard backdrop-blur">
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
                  onClick={() => goToStep(step.id)}
                  disabled={isPending || step.id > maxReachableStep}
                  className={`rounded-pill px-4 py-2 text-sm transition-colors ${
                    currentStep === step.id
                      ? 'bg-[var(--accent-primary)] text-[var(--on-accent)]'
                      : step.id > maxReachableStep
                        ? 'cursor-not-allowed border border-[var(--border-default)] bg-[var(--bg-tertiary)] text-[var(--text-secondary)] opacity-50'
                        : 'border border-[var(--border-default)] bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:border-[var(--accent-primary)] hover:text-[var(--text-primary)]'
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
                  label="作品名称"
                  placeholder="给作品起一个正式标题"
                  value={formData.novel_name || ''}
                  onChange={event => updateForm({ novel_name: event.target.value })}
                />

                <div className="space-y-2">
                  <label className="text-[var(--text-body)] text-sm font-medium">内容类型</label>
                  <Select
                    value={formData.content_type}
                    onValueChange={(value) => updateForm({ content_type: value as ContentType })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="选择内容类型">{selectedContentType?.label}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {contentTypes.map(type => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <Textarea
                  label="作品简介"
                  placeholder="介绍故事背景、主要人物关系"
                  value={formData.novel_description || ''}
                  onChange={(event: React.ChangeEvent<HTMLTextAreaElement>) => updateForm({ novel_description: event.target.value })}
                />
              </div>
            )}

            {currentStep === 2 && (
              <div className="space-y-5">
                <h2 className="text-2xl font-medium">创作 Brief</h2>

                <div className="grid gap-4 md:grid-cols-2">
                  <Input
                    label="小说题材"
                    placeholder="都市重生 / 玄幻穿越..."
                    value={formData.genre || ''}
                    onChange={event => updateForm({ genre: event.target.value })}
                  />
                  <Input
                    label="核心钩子"
                    placeholder="一句话说清它为什么抓人"
                    value={formData.core_hook || ''}
                    onChange={(event: React.ChangeEvent<HTMLInputElement>) => updateForm({ core_hook: event.target.value })}
                  />
                </div>

                <Input
                  label="目标总字数"
                  type="number"
                  placeholder="100000"
                  value={formData.total_words || ''}
                  onChange={(event: React.ChangeEvent<HTMLInputElement>) => updateForm({ total_words: parseInt(event.target.value, 10) || 0 })}
                />

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
                <h2 className="text-2xl font-medium">作家风格</h2>

                <SkillPicker
                  skills={skills}
                  enabledSkills={enabledSkills}
                  isLoading={isSkillsLoading}
                  searchPlaceholder="搜索作家风格..."
                  loadingText="正在加载风格库..."
                  emptyText="没有匹配的风格"
                  itemClassName="p-4"
                  onChange={updateEnabledSkills}
                />
              </div>
            )}

            {currentStep === 4 && (
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

                <div className="space-y-3 rounded-comfortable border border-[var(--border-default)] bg-[var(--bg-tertiary)] p-4 text-sm">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="skip_plan_confirm"
                      checked={formData.skip_plan_confirmation}
                      onChange={event => updateForm({ skip_plan_confirmation: event.target.checked })}
                      className="rounded border-[var(--border-default)] accent-[var(--accent-primary)]"
                    />
                    <span>跳过策划方案人工确认</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="skip_chapter_confirm"
                      checked={formData.skip_chapter_confirmation}
                      onChange={event => updateForm({ skip_chapter_confirmation: event.target.checked })}
                      className="rounded border-[var(--border-default)] accent-[var(--accent-primary)]"
                    />
                    <span>跳过章节级人工确认</span>
                  </label>
                </div>

                <div className="rounded-comfortable border border-[rgba(var(--accent-primary-rgb),0.20)] bg-[rgba(var(--accent-primary-rgb),0.08)] p-4">
                  <p className="font-medium text-xs uppercase tracking-[0.24em] text-[var(--text-secondary)]">Selected Mode</p>
                  <h3 className="mt-2 text-lg font-medium">{getModeLabel(formData)}</h3>
                </div>
              </div>
            )}

            {currentStep === 5 && (
              <div className="space-y-5">
                <h2 className="text-2xl font-medium">确认创建</h2>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-standard border border-[var(--border-default)] bg-[var(--bg-tertiary)] p-4">
                    <p className="text-sm text-[var(--text-secondary)]">作品名称</p>
                    <p className="mt-1 font-medium">{workName || '未填写'}</p>
                  </div>
                  <div className="rounded-standard border border-[var(--border-default)] bg-[var(--bg-tertiary)] p-4">
                    <p className="text-sm text-[var(--text-secondary)]">内容类型</p>
                    <p className="mt-1 font-medium">{selectedContentType?.label || '未选择'}</p>
                  </div>
                  <div className="rounded-standard border border-[var(--border-default)] bg-[var(--bg-tertiary)] p-4">
                    <p className="text-sm text-[var(--text-secondary)]">章节范围</p>
                    <p className="mt-1 font-medium">{formData.start_chapter} - {formData.end_chapter}</p>
                  </div>
                  <div className="rounded-standard border border-[var(--border-default)] bg-[var(--bg-tertiary)] p-4">
                    <p className="text-sm text-[var(--text-secondary)]">协作模式</p>
                    <p className="mt-1 font-medium">{getModeLabel(formData)}</p>
                  </div>
                  <div className="rounded-standard border border-[var(--border-default)] bg-[var(--bg-tertiary)] p-4">
                    <p className="text-sm text-[var(--text-secondary)]">创作风格</p>
                    <p className="mt-1 font-medium">{selectedSkillNames.join('、') || '未选择'}</p>
                  </div>
                </div>

                <div className="rounded-comfortable border border-[var(--border-default)] bg-[var(--bg-tertiary)] p-4">
                  <p className="font-medium text-xs uppercase tracking-[0.24em] text-[var(--text-secondary)]">Core Requirement</p>
                  <div className="mt-3 space-y-2 text-sm">
                    <p><span className="text-[var(--text-secondary)]">作品名称：</span>{workName || '未填写'}</p>
                    <p><span className="text-[var(--text-secondary)]">作品简介：</span>{workDescription || '未填写'}</p>
                    <p><span className="text-[var(--text-secondary)]">题材：</span>{formData.genre || '未填写'}</p>
                    <p><span className="text-[var(--text-secondary)]">核心钩子：</span>{formData.core_hook || '未填写'}</p>
                    <p><span className="text-[var(--text-secondary)]">目标总字数：</span>{formData.total_words || '未填写'}</p>
                    <p><span className="text-[var(--text-secondary)]">发布平台：</span>{formData.target_platform || '未填写'}</p>
                    <p><span className="text-[var(--text-secondary)]">创作风格：</span>{selectedSkillNames.join('、') || '未选择'}</p>
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
                  <Button variant="primary" onClick={handleSubmit} disabled={isPending || !!firstInvalidStep}>
                    {isPending ? '创建中...' : '创建项目'}
                  </Button>
                )}
              </div>
            </div>
          </Card>

          <Card>
            <p className="font-medium text-xs uppercase tracking-[0.24em] text-[var(--text-secondary)]">Live Summary</p>

            <div className="mt-5 space-y-3">
              <div className="rounded-standard border border-[var(--border-default)] bg-[var(--bg-tertiary)] p-4">
                <p className="text-sm text-[var(--text-secondary)]">作品名称</p>
                <p className="mt-1 font-medium">{workName || '-'}</p>
              </div>
              <div className="rounded-standard border border-[var(--border-default)] bg-[var(--bg-tertiary)] p-4">
                <p className="text-sm text-[var(--text-secondary)]">内容类型</p>
                <p className="mt-1 font-medium">{selectedContentType?.label || '-'}</p>
              </div>
              <div className="rounded-standard border border-[var(--border-default)] bg-[var(--bg-tertiary)] p-4">
                <p className="text-sm text-[var(--text-secondary)]">生成范围</p>
                <p className="mt-1 font-medium">
                  {formData.start_chapter} - {formData.end_chapter} 章
                </p>
              </div>
              <div className="rounded-standard border border-[var(--border-default)] bg-[var(--bg-tertiary)] p-4">
                <p className="text-sm text-[var(--text-secondary)]">协作模式</p>
                <p className="mt-1 font-medium">{getModeLabel(formData)}</p>
              </div>
              <div className="rounded-standard border border-[var(--border-default)] bg-[var(--bg-tertiary)] p-4">
                <p className="text-sm text-[var(--text-secondary)]">创作风格</p>
                <p className="mt-1 font-medium">{selectedSkillNames.join('、') || '未选择'}</p>
              </div>
            </div>
          </Card>
        </div>
      </div>
    
  )
}

export default CreateProject
