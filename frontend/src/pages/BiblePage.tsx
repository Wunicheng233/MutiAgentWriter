import React, { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { getProject } from '../utils/endpoints'
import { useBibleStore } from '../store/useBibleStore'
import { Card, Button } from '../components/v2'
import { parseBibleFromPlan } from '../utils/bibleParser'
import type { CharacterRole } from '../types/api'

const TabButton: React.FC<{
  active: boolean
  onClick: () => void
  children: React.ReactNode
}> = ({ active, onClick, children }) => (
  <button
    role="tab"
    aria-selected={active}
    onClick={onClick}
    className={`px-4 py-2 text-sm font-medium rounded-lg transition-all duration-150 ${
      active
        ? 'bg-[var(--accent-primary)] text-white'
        : 'text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]'
    }`}
  >
    {children}
  </button>
)

const CharacterTab: React.FC = () => {
  const { bible, addCharacter, deleteCharacter } = useBibleStore()
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    role: 'support' as CharacterRole,
    personality: '',
    appearance: '',
    background: '',
    catchphrase: '',
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.name.trim()) return

    addCharacter(formData)
    setFormData({
      name: '',
      role: 'support',
      personality: '',
      appearance: '',
      background: '',
      catchphrase: '',
    })
    setShowForm(false)
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium text-[var(--text-primary)]">角色列表</h3>
        <Button onClick={() => setShowForm(!showForm)} variant="primary" size="sm">
          {showForm ? '取消' : '+ 添加角色'}
        </Button>
      </div>

      {showForm && (
        <Card>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">角色名</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-[var(--border-default)] bg-[var(--bg-primary)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]"
                placeholder="输入角色名"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">角色类型</label>
              <select
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value as CharacterRole })}
                className="w-full px-3 py-2 rounded-lg border border-[var(--border-default)] bg-[var(--bg-primary)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]"
              >
                <option value="protagonist">主角</option>
                <option value="support">配角</option>
                <option value="npc">NPC</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">性格</label>
              <textarea
                value={formData.personality}
                onChange={(e) => setFormData({ ...formData, personality: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-[var(--border-default)] bg-[var(--bg-primary)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]"
                rows={2}
                placeholder="描述角色性格"
              />
            </div>
            <div className="flex gap-2">
              <Button type="submit" variant="primary">保存</Button>
              <Button type="button" variant="secondary" onClick={() => setShowForm(false)}>取消</Button>
            </div>
          </form>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {bible.characters.map((char) => (
          <Card key={char.id}>
            <div className="flex justify-between items-start">
              <div>
                <h4 className="font-medium text-[var(--text-primary)]">{char.name}</h4>
                <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--bg-tertiary)] text-[var(--text-secondary)]">
                  {char.role === 'protagonist' ? '主角' : char.role === 'support' ? '配角' : 'NPC'}
                </span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => deleteCharacter(char.id)}
                className="text-red-500 hover:text-red-600"
              >
                删除
              </Button>
            </div>
            {char.personality && (
              <p className="mt-2 text-sm text-[var(--text-secondary)]">
                <span className="font-medium">性格：</span>{char.personality}
              </p>
            )}
            {char.catchphrase && (
              <p className="mt-1 text-sm text-[var(--text-secondary)] italic">
                "{char.catchphrase}"
              </p>
            )}
          </Card>
        ))}
      </div>

      {bible.characters.length === 0 && !showForm && (
        <Card className="text-center py-8">
          <p className="text-[var(--text-secondary)]">还没有添加任何角色</p>
          <p className="text-sm text-[var(--text-tertiary)] mt-1">点击上方按钮添加第一个角色</p>
        </Card>
      )}
    </div>
  )
}

const WorldTab: React.FC = () => {
  const { bible, updateWorldSetting } = useBibleStore()

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-medium text-[var(--text-primary)]">世界观设定</h3>
      <Card>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">力量体系</label>
            <textarea
              value={bible.world.powerSystem || ''}
              onChange={(e) => updateWorldSetting({ powerSystem: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-[var(--border-default)] bg-[var(--bg-primary)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]"
              rows={4}
              placeholder="描述这个世界的力量体系..."
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">世界规则</label>
            <textarea
              value={bible.world.rules || ''}
              onChange={(e) => updateWorldSetting({ rules: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-[var(--border-default)] bg-[var(--bg-primary)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]"
              rows={4}
              placeholder="描述世界的特殊规则..."
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">文化风俗</label>
            <textarea
              value={bible.world.culture || ''}
              onChange={(e) => updateWorldSetting({ culture: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-[var(--border-default)] bg-[var(--bg-primary)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]"
              rows={4}
              placeholder="描述世界的文化和风俗..."
            />
          </div>
        </div>
      </Card>
    </div>
  )
}

const PlotTab: React.FC = () => {
  const { bible, updatePlotSetting } = useBibleStore()

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-medium text-[var(--text-primary)]">情节设定</h3>
      <Card>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">核心主题</label>
            <textarea
              value={bible.plot.coreTheme || ''}
              onChange={(e) => updatePlotSetting({ coreTheme: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-[var(--border-default)] bg-[var(--bg-primary)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]"
              rows={3}
              placeholder="故事的核心主题..."
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">故事梗概</label>
            <textarea
              value={bible.plot.synopsis || ''}
              onChange={(e) => updatePlotSetting({ synopsis: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-[var(--border-default)] bg-[var(--bg-primary)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]"
              rows={5}
              placeholder="整体故事梗概..."
            />
          </div>
        </div>
      </Card>
    </div>
  )
}

const TodoTab: React.FC = () => {
  const { bible, addTodo, updateTodo, deleteTodo } = useBibleStore()
  const [newTodo, setNewTodo] = useState('')

  const handleAddTodo = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newTodo.trim()) return

    addTodo({
      content: newTodo,
      type: 'consistency',
      completed: false,
    })
    setNewTodo('')
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-medium text-[var(--text-primary)]">待办事项</h3>
      <Card>
        <form onSubmit={handleAddTodo} className="flex gap-2 mb-4">
          <input
            type="text"
            value={newTodo}
            onChange={(e) => setNewTodo(e.target.value)}
            placeholder="添加新的待办事项..."
            className="flex-1 px-3 py-2 rounded-lg border border-[var(--border-default)] bg-[var(--bg-primary)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]"
          />
          <Button type="submit" variant="primary">添加</Button>
        </form>

        <div className="space-y-2">
          {bible.todos.map((todo) => (
            <div
              key={todo.id}
              className="flex items-center gap-3 p-3 rounded-lg bg-[var(--bg-secondary)]"
            >
              <input
                type="checkbox"
                checked={todo.completed}
                onChange={() => updateTodo(todo.id, { completed: !todo.completed })}
                className="w-4 h-4 rounded border-[var(--border-default)]"
              />
              <span className={`flex-1 ${todo.completed ? 'line-through text-[var(--text-tertiary)]' : 'text-[var(--text-primary)]'}`}>
                {todo.content}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => deleteTodo(todo.id)}
                className="text-red-500 hover:text-red-600"
              >
                删除
              </Button>
            </div>
          ))}
        </div>

        {bible.todos.length === 0 && (
          <p className="text-center text-[var(--text-secondary)] py-4">暂无待办事项</p>
        )}
      </Card>
    </div>
  )
}

const BiblePage: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const projectId = id ? parseInt(id, 10) : 0
  const { loadFromProject, saveToProject, isLoading } = useBibleStore()
  const [activeTab, setActiveTab] = useState('characters')
  const [showImport, setShowImport] = useState(false)
  const [importText, setImportText] = useState('')

  useQuery({
    queryKey: ['project', projectId],
    queryFn: () => getProject(projectId),
    enabled: projectId > 0,
  })

  useEffect(() => {
    if (projectId > 0) {
      loadFromProject(projectId)
    }
  }, [projectId, loadFromProject])

  const handleImport = () => {
    const parsed = parseBibleFromPlan(importText)
    if (parsed.characters) {
      parsed.characters.forEach((char) => {
        useBibleStore.getState().addCharacter(char)
      })
    }
    if (parsed.world) {
      useBibleStore.getState().updateWorldSetting(parsed.world)
    }
    setShowImport(false)
    setImportText('')
  }

  const tabs = [
    { id: 'characters', label: '角色设定', component: CharacterTab },
    { id: 'world', label: '世界观设定', component: WorldTab },
    { id: 'plot', label: '情节设定', component: PlotTab },
    { id: 'todos', label: '待办事项', component: TodoTab },
  ]

  const ActiveComponent = tabs.find((t) => t.id === activeTab)?.component || CharacterTab

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">设定库</h1>
        <div className="flex gap-2">
          <Button onClick={() => setShowImport(!showImport)} variant="secondary" size="sm">
            {showImport ? '取消' : '从策划文档导入'}
          </Button>
          {!showImport && (
            <Button onClick={() => saveToProject(projectId)} variant="primary" size="sm" loading={isLoading}>
              保存
            </Button>
          )}
        </div>
      </div>

      {showImport && (
        <Card>
          <h3 className="text-lg font-medium text-[var(--text-primary)] mb-4">从策划文档导入</h3>
          <textarea
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-[var(--border-default)] bg-[var(--bg-primary)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)] mb-4"
            rows={10}
            placeholder="粘贴你的策划文档内容，我们将自动解析角色和世界观设定..."
          />
          <div className="flex gap-2">
            <Button onClick={handleImport} variant="primary">解析并导入</Button>
            <Button onClick={() => { setShowImport(false); setImportText('') }} variant="secondary">取消</Button>
          </div>
        </Card>
      )}

      <div className="flex gap-2 border-b border-[var(--border-default)] pb-2" role="tablist">
        {tabs.map((tab) => (
          <TabButton
            key={tab.id}
            active={activeTab === tab.id}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </TabButton>
        ))}
      </div>

      <ActiveComponent />
    </div>
  )
}

export default BiblePage
