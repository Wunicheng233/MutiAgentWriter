import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Badge, Button, Card, Divider } from '../components/v2'
import OnboardingTour from '../components/onboarding/OnboardingTour'

type GuideStep = {
  title: string
  detail: string
  actionLabel?: string
  actionHref?: string
}

type PageGuide = {
  title: string
  route: string
  summary: string
  details: string[]
}

const quickStartSteps: GuideStep[] = [
  {
    title: '配置模型 API',
    detail: '没有系统默认额度时，先在设置页选择供应商、填写模型 ID 和 API Key，然后点击测试连接确认真实可用。火山方舟的模型 ID 复制控制台调用示例里的 model 值。',
    actionLabel: '打开 API 设置',
    actionHref: '/settings?tab=ai',
  },
  {
    title: '新建创作项目',
    detail: '填写小说名称、核心设定、目标章节和协作方式。逐章共创适合比赛演示，策划确认适合先把大方向定稳。',
    actionLabel: '新建项目',
    actionHref: '/projects/new',
  },
  {
    title: '生成前检查',
    detail: '项目概览会展示章节范围、预计字数、预计 Token 和模型配置问题。出现红色提示时先处理，再启动生成。',
  },
  {
    title: '确认与修订',
    detail: '策划确认和逐章共创都会进入人工确认环节。通过后继续生成，不通过则填写反馈让系统定向修改。',
  },
  {
    title: '阅读、编辑、导出',
    detail: '阅读器用于沉浸阅读，编辑器用于分段编辑和 AI 选区润色，导出分享页用于生成 EPUB、DOCX、HTML 和公开链接。',
  },
]

const apiChecklist = [
  {
    label: '模型供应商',
    value: '火山、OpenAI、DeepSeek、通义、Moonshot 或自定义兼容接口。',
  },
  {
    label: 'API Base URL',
    value: '预设供应商可留空使用默认地址。火山普通在线推理推荐 https://ark.cn-beijing.volces.com/api/v3。',
  },
  {
    label: '模型 ID',
    value: '必填。火山方舟复制控制台调用示例里的 model 值；DeepSeek 可填 deepseek-chat；OpenAI 填实际模型名。',
  },
  {
    label: 'API Key',
    value: '来自对应供应商控制台。留空会保留当前 Key；测试连接会优先使用当前输入的新 Key。',
  },
]

const pageGuides: PageGuide[] = [
  {
    title: '书架',
    route: '/dashboard',
    summary: '查看所有项目、状态和总体质量分。',
    details: ['新建项目入口在右上角。', '项目卡片会显示生成中、已完成、失败等状态。'],
  },
  {
    title: '新建项目',
    route: '/projects/new',
    summary: '定义作品类型、小说设定、章节范围、协作模式和作家风格 Skill。',
    details: ['信息未填完整时不应跳步创建。', '同一项目只建议选择一个作家风格 Skill。'],
  },
  {
    title: '概览',
    route: '项目内 /overview',
    summary: '项目主控台，负责启动生成、继续生成、取消任务和处理确认。',
    details: ['生成前预检会显示预计 Token 和模型配置风险。', '逐章共创模式下，章节确认会在这里弹出。'],
  },
  {
    title: '大纲',
    route: '项目内 /outline',
    summary: '查看和调整策划方案、创作配置和 Skill 注入。',
    details: ['适合在正式生成前检查故事方向。', '已生成项目也可以回看设定和大纲。'],
  },
  {
    title: '章节',
    route: '项目内 /chapters',
    summary: '按章节查看生成状态、标题、字数和质量分。',
    details: ['可以快速跳到阅读器或编辑器。', '若某章未生成，优先回概览继续生成。'],
  },
  {
    title: '阅读器',
    route: '项目内 /read/1',
    summary: '沉浸式阅读生成文本，支持字体、翻页和阅读偏好。',
    details: ['适合验收故事观感。', '分页模式用于模拟真实阅读体验。'],
  },
  {
    title: '编辑器',
    route: '项目内 /editor/1',
    summary: '修改章节文本，并使用 AI 选区润色、扩写、缩写和增强戏剧张力。',
    details: ['章节切换在顶部选择器。', '建议对局部段落做选区操作，避免整章反复重写。'],
  },
  {
    title: '设定库',
    route: '项目内 /bible',
    summary: '沉淀角色、世界观、时间线、伏笔等长篇叙事状态。',
    details: ['用于检查跨章一致性。', '生成质量不稳时优先检查设定是否清晰。'],
  },
  {
    title: '质量中心',
    route: '项目内 /analytics',
    summary: '查看章节质量、维度评分和评审反馈。',
    details: ['适合定位人物、情节、逻辑、节奏等问题。', '逐章共创模式也会同步展示可用评分。'],
  },
  {
    title: '历史版本',
    route: '项目内 /versions',
    summary: '回看编辑和 AI 修改形成的版本记录。',
    details: ['适合比较润色前后的文本。', '重要修改前建议保留版本。'],
  },
  {
    title: '导出分享',
    route: '项目内 /export',
    summary: '生成 EPUB、DOCX、HTML 文件，并创建公开分享链接。',
    details: ['项目完成后才开放导出。', '分享链接支持有效期和访问统计。'],
  },
  {
    title: '设置',
    route: '/settings',
    summary: '管理主题、阅读编辑偏好、模型供应商、快捷键和本地状态。',
    details: ['API 设置在 AI 标签下。', '使用自带 Key 时不占用平台 Token 预算。'],
  },
]

export const Guide = () => {
  const [tourOpen, setTourOpen] = useState(false)

  return (
    <div className="mx-auto max-w-content space-y-6">
      <section className="space-y-3">
        <Badge variant="secondary">帮助</Badge>
        <h1 className="text-3xl md:text-4xl font-semibold text-[var(--text-primary)]">从模型配置到第一本小说</h1>
        <p className="max-w-3xl text-[var(--text-secondary)] leading-7">
          这份教程覆盖最容易卡住的 API 设置，以及各个页面在创作流程里的位置。先完成模型配置，再创建项目，最后在概览页启动并确认生成流程。
        </p>
        <Button variant="primary" size="sm" onClick={() => setTourOpen(true)}>
          播放引导动画
        </Button>
      </section>

      <Card className="p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-[var(--text-secondary)]">API Setup</p>
            <h2 className="mt-2 text-2xl font-medium text-[var(--text-primary)]">API 设置优先检查</h2>
            <p className="mt-2 text-[var(--text-secondary)] leading-7">
              如果不能生成小说，第一优先级通常不是项目内容，而是模型路由。确认供应商、Base URL、模型 ID 和 API Key 四项都对应同一家服务，并先用测试连接验证。
            </p>
          </div>
          <Link to="/settings?tab=ai">
            <Button variant="primary" size="sm">前往 API 设置</Button>
          </Link>
        </div>

        <Divider className="my-5" />

        <div className="grid gap-3 md:grid-cols-2">
          {apiChecklist.map((item) => (
            <div key={item.label} className="rounded-standard border border-[var(--border-default)] bg-[var(--bg-tertiary)] p-4">
              <p className="font-medium text-[var(--text-primary)]">{item.label}</p>
              <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">{item.value}</p>
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-[var(--text-secondary)]">Quick Start</p>
            <h2 className="mt-2 text-2xl font-medium text-[var(--text-primary)]">推荐启动顺序</h2>
          </div>
          <Link to="/projects/new">
            <Button variant="secondary" size="sm">开始新项目</Button>
          </Link>
        </div>

        <div className="mt-5 grid gap-3">
          {quickStartSteps.map((step, index) => (
            <div key={step.title} className="grid gap-4 rounded-standard border border-[var(--border-default)] bg-[var(--bg-secondary)] p-4 md:grid-cols-[48px_1fr_auto] md:items-center">
              <div className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--accent-primary)] text-sm font-medium text-[var(--accent-primary)]">
                {index + 1}
              </div>
              <div>
                <p className="font-medium text-[var(--text-primary)]">{step.title}</p>
                <p className="mt-1 text-sm leading-6 text-[var(--text-secondary)]">{step.detail}</p>
              </div>
              {step.actionHref && step.actionLabel && (
                <Link to={step.actionHref}>
                  <Button variant="tertiary" size="sm">{step.actionLabel}</Button>
                </Link>
              )}
            </div>
          ))}
        </div>
      </Card>

      <section className="space-y-4">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-[var(--text-secondary)]">Pages</p>
          <h2 className="mt-2 text-2xl font-medium text-[var(--text-primary)]">各页面基本功能</h2>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          {pageGuides.map((page) => (
            <Card key={page.title} className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-xl font-medium text-[var(--text-primary)]">{page.title}</h3>
                  <p className="mt-1 text-xs text-[var(--text-muted)]">{page.route}</p>
                </div>
                <Badge variant="secondary">Guide</Badge>
              </div>
              <p className="mt-4 text-sm leading-6 text-[var(--text-secondary)]">{page.summary}</p>
              <ul className="mt-3 space-y-2 text-sm leading-6 text-[var(--text-secondary)]">
                {page.details.map((detail) => (
                  <li key={detail} className="flex gap-2">
                    <span className="mt-[9px] h-1.5 w-1.5 rounded-full bg-[var(--accent-primary)]" />
                    <span>{detail}</span>
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </div>
      </section>
      <OnboardingTour open={tourOpen} onClose={() => setTourOpen(false)} />
    </div>
  )
}

export default Guide
