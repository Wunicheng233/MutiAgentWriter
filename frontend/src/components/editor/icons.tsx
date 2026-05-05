import React from 'react'

// 润色 - 魔法棒/星星
export const PolishIcon: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 3L14 7L18 9L14 11L12 15L10 11L6 9L10 7L12 3Z" fill="currentColor" fillOpacity="0.7"/>
    <path d="M5 15L6 17L8 18L6 19L5 21L4 19L2 18L4 17L5 15Z" fill="currentColor" fillOpacity="0.7"/>
    <path d="M19 15L20 17L22 18L20 19L19 21L18 19L16 18L18 17L19 15Z" fill="currentColor" fillOpacity="0.7"/>
  </svg>
)

// 扩写 - 展开/放大
export const ExpandIcon: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M4 4H9V6H6V9H4V4Z" fill="currentColor" fillOpacity="0.7"/>
    <path d="M15 4H20V9H18V6H15V4Z" fill="currentColor" fillOpacity="0.7"/>
    <path d="M4 15H6V18H9V20H4V15Z" fill="currentColor" fillOpacity="0.7"/>
    <path d="M15 20H20V15H18V18H15V20Z" fill="currentColor" fillOpacity="0.7"/>
    <path d="M9 12L12 9L15 12L12 15L9 12Z" fill="currentColor" fillOpacity="0.7"/>
  </svg>
)

// 缩写 - 缩小/减号
export const ShortenIcon: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M5 12H19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeOpacity="0.7"/>
    <path d="M10 6L4 12L10 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" strokeOpacity="0.7"/>
    <path d="M14 6L20 12L14 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" strokeOpacity="0.7"/>
  </svg>
)

// 增强戏剧张力 - 闪电/感叹号
export const DramaticIcon: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M13 2L4 14H11L10 22L19 10H12L13 2Z" fill="currentColor" fillOpacity="0.7"/>
  </svg>
)

// 植入伏笔 - 种子/ planted flag
export const ForeshadowIcon: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 22C12 22 18 18 18 12C18 8.686 15.314 6 12 6C8.686 6 6 8.686 6 12C6 18 12 22 12 22Z" fill="currentColor" fillOpacity="0.5"/>
    <path d="M12 6V2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeOpacity="0.7"/>
    <path d="M12 2C13.6569 2 15 3.34315 15 5C15 6.65685 13.6569 8 12 8C10.3431 8 9 6.65685 9 5C9 3.34315 10.3431 2 12 2Z" fill="currentColor" fillOpacity="0.7"/>
  </svg>
)

// 检查连续性 - 链接/检查
export const ContinuityIcon: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M10 13L12 15L16 11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" strokeOpacity="0.7"/>
    <path d="M3 7C3 4.79086 4.79086 3 7 3H10C12.2091 3 14 4.79086 14 7V10C14 12.2091 12.2091 14 10 14H7C4.79086 14 3 12.2091 3 10V7Z" stroke="currentColor" strokeWidth="2" strokeOpacity="0.7"/>
    <path d="M10 17C10 19.2091 11.7909 21 14 21H17C19.2091 21 21 19.2091 21 17V14C21 11.7909 19.2091 10 17 10H14C11.7909 10 10 11.7909 10 14V17Z" stroke="currentColor" strokeWidth="2" strokeOpacity="0.7"/>
  </svg>
)

// 关闭 - X
export const CloseIcon: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeOpacity="0.7"/>
    <path d="M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeOpacity="0.7"/>
  </svg>
)

// 铅笔/编辑
export const PencilIcon: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M17 3L21 7L7 21H3V17L17 3Z" fill="currentColor" fillOpacity="0.5"/>
    <path d="M17 3L14 6L18 10L21 7L17 3Z" fill="currentColor" fillOpacity="0.7"/>
    <path d="M14 6L7 13L11 17L18 10L14 6Z" fill="currentColor" fillOpacity="0.5"/>
  </svg>
)

// 加载/旋转动画
export const SpinnerIcon: React.FC<{ className?: string }> = ({ className = 'w-6 h-6' }) => (
  <svg className={`${className} animate-spin`} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" strokeOpacity="0.2"/>
    <path d="M12 2C14.6522 2 17.1957 3.05357 19.0711 4.92893C20.9464 6.8043 22 9.34784 22 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeOpacity="0.7"/>
  </svg>
)

// 向下箭头
export const ChevronDownIcon: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M6 9L12 15L18 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" strokeOpacity="0.7"/>
  </svg>
)

// 角色/用户
export const CharacterIcon: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M20 21V19C20 17.9391 19.5786 16.9217 18.8284 16.1716C18.0783 15.4214 17.0609 15 16 15H8C6.93913 15 5.92172 15.4214 5.17157 16.1716C4.42143 16.9217 4 17.9391 4 19V21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" strokeOpacity="0.7"/>
    <path d="M12 11C14.2091 11 16 9.20914 16 7C16 4.79086 14.2091 3 12 3C9.79086 3 8 4.79086 8 7C8 9.20914 9.79086 11 12 11Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" strokeOpacity="0.7"/>
  </svg>
)
