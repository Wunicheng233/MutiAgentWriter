import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { Layout } from '../components/Layout'
import { Card } from '../components/Card'
import { Input, Textarea } from '../components/Input'
import { Button } from '../components/Button'
import { ProgressBar } from '../components/ProgressBar'
import { createProject } from '../utils/endpoints'
import { useToast } from '../components/Toast'
import type { ProjectCreate } from '../types/api'

const steps = [
  { id: 1, title: '基本信息' },
  { id: 2, title: '创作需求' },
  { id: 3, title: '参数设置' },
  { id: 4, title: '确认创建' },
]

const contentTypes = [
  { value: 'full_novel', label: '长篇小说' },
  { value: 'short_story', label: '短篇小说' },
  { value: 'script', label: '剧本' },
]

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
    onSuccess: (data) => {
      showToast('项目创建成功', 'success')
      navigate(`/projects/${data.id}/overview`)
    },
    onError: (error: any) => {
      const message = error.response?.data?.detail || '创建失败'
      showToast(message, 'error')
    },
  })

  const progress = ((currentStep - 1) / (steps.length - 1)) * 100

  const nextStep = () => {
    if (currentStep < steps.length) {
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
    <Layout>
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl mb-6">新建创作项目</h1>

        <div className="mb-8">
          <ProgressBar progress={progress} message={`步骤 ${currentStep}/${steps.length}: ${steps[currentStep - 1].title}`} />
        </div>

        <Card>
          {currentStep === 1 && (
            <div className="space-y-4">
              <Input
                label="项目名称"
                placeholder="给你的作品起一个名字"
                value={formData.name || ''}
                onChange={e => updateForm({ name: e.target.value })}
              />
              <Textarea
                label="项目简介"
                placeholder="简单介绍一下你的作品..."
                value={formData.description || ''}
                onChange={e => updateForm({ description: e.target.value })}
              />
              <div className="space-y-2">
                <label className="text-body text-sm font-medium">内容类型</label>
                <div className="grid grid-cols-3 gap-3">
                  {contentTypes.map(type => (
                    <label
                      key={type.value}
                      className={`flex items-center justify-center px-3 py-3 border rounded-standard cursor-pointer ${
                        formData.content_type === type.value
                          ? 'bg-sage/10 border-sage text-inkwell'
                          : 'border-border text-secondary hover:border-sage/50'
                      }`}
                    >
                      <input
                        type="radio"
                        name="content_type"
                        value={type.value}
                        checked={formData.content_type === type.value}
                        onChange={e => updateForm({ content_type: e.target.value as any })}
                        className="sr-only"
                      />
                      {type.label}
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}

          {currentStep === 2 && (
            <div className="space-y-4">
              <Input
                label="小说名称"
                placeholder="和项目名称可以相同"
                value={formData.novel_name || ''}
                onChange={e => updateForm({ novel_name: e.target.value })}
              />
              <Textarea
                label="小说简介"
                placeholder="故事背景、主要人物、核心主题..."
                value={formData.novel_description || ''}
                onChange={e => updateForm({ novel_description: e.target.value })}
              />
              <Textarea
                label="核心创作需求"
                placeholder="详细描述你想要的故事，包括风格、节奏、特殊要求..."
                className="min-h-[160px]"
                value={formData.core_requirement || ''}
                onChange={e => updateForm({ core_requirement: e.target.value })}
              />
            </div>
          )}

          {currentStep === 3 && (
            <div className="space-y-4">
              <Input
                label="目标发布平台"
                placeholder="网络小说 / 出版 / 公众号..."
                value={formData.target_platform || ''}
                onChange={e => updateForm({ target_platform: e.target.value })}
              />
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="每章字数"
                  type="number"
                  placeholder="2000"
                  value={formData.chapter_word_count || ''}
                  onChange={e => updateForm({ chapter_word_count: parseInt(e.target.value) })}
                />
                <Input
                  label="结束章节"
                  type="number"
                  placeholder="10"
                  value={formData.end_chapter || ''}
                  onChange={e => updateForm({ end_chapter: parseInt(e.target.value) })}
                />
              </div>
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="skip_plan_confirm"
                    checked={formData.skip_plan_confirmation}
                    onChange={e => updateForm({ skip_plan_confirmation: e.target.checked })}
                    className="text-sage rounded border-border focus:ring-sage"
                  />
                  <label htmlFor="skip_plan_confirm" className="text-sm text-body">
                    跳过策划方案人工确认（全自动模式）
                  </label>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="skip_chapter_confirm"
                    checked={formData.skip_chapter_confirmation}
                    onChange={e => updateForm({ skip_chapter_confirmation: e.target.checked })}
                    className="text-sage rounded border-border focus:ring-sage"
                  />
                  <label htmlFor="skip_chapter_confirm" className="text-sm text-body">
                    跳过章节级人工确认（全自动生成全部章节）
                  </label>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="allow_plot_adjustment"
                    checked={formData.allow_plot_adjustment}
                    onChange={e => updateForm({ allow_plot_adjustment: e.target.checked })}
                    className="text-sage rounded border-border focus:ring-sage"
                  />
                  <label htmlFor="allow_plot_adjustment" className="text-sm text-body">
                    允许每章后调整下一章剧情（人在环路可控创作）
                  </label>
                </div>
              </div>
            </div>
          )}

          {currentStep === 4 && (
            <div className="space-y-4">
              <h3 className="text-lg font-medium">请确认你的信息</h3>
              <div className="bg-parchment rounded-standard p-4 space-y-2 text-sm">
                <p><span className="text-secondary">项目名称：</span> {formData.name}</p>
                <p><span className="text-secondary">内容类型：</span> {contentTypes.find(t => t.value === formData.content_type)?.label}</p>
                <p><span className="text-secondary">小说名称：</span> {formData.novel_name}</p>
                <p><span className="text-secondary">生成章节：</span> {formData.start_chapter} - {formData.end_chapter}</p>
                <p><span className="text-secondary">每章字数：</span> {formData.chapter_word_count}</p>
                <div className="space-y-1">
                  <p className="text-secondary">人机交互选项：</p>
                  <ul className="list-disc list-inside pl-2 space-y-1">
                    <li>跳过策划确认：{formData.skip_plan_confirmation ? '是' : '否'}</li>
                    <li>跳过章节确认：{formData.skip_chapter_confirmation ? '是' : '否'}</li>
                    <li>允许剧情调整：{formData.allow_plot_adjustment ? '是' : '否'}</li>
                  </ul>
                </div>
                {formData.core_requirement && (
                  <div>
                    <span className="text-secondary">核心需求：</span>
                    <p className="whitespace-pre-line mt-1">{formData.core_requirement}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="flex justify-between mt-8">
            <Button
              variant="secondary"
              onClick={prevStep}
              disabled={currentStep === 1 || isPending}
            >
              上一步
            </Button>
            {currentStep < steps.length ? (
              <Button variant="primary" onClick={nextStep} disabled={isPending}>
                下一步
              </Button>
            ) : (
              <Button variant="primary" onClick={handleSubmit} disabled={isPending}>
                {isPending ? '创建中...' : '创建项目'}
              </Button>
            )}
          </div>
        </Card>
      </div>
    </Layout>
  )
}

export default CreateProject
