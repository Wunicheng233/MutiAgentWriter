import type {CSSProperties, ReactNode} from 'react';
import {interpolate, useCurrentFrame} from 'remotion';
import {ProgressBadge} from './ProgressBadge';
import {theme} from '../theme';

const card: CSSProperties = {
  border: `1px solid ${theme.colors.line}`,
  borderRadius: 18,
  background: 'rgba(255, 253, 248, 0.86)',
  boxShadow: '0 20px 58px rgba(58, 46, 36, 0.08)'
};

const sidebarIcons = ['书', '纲', '章', '读', '编', '质', '导'];

const Shell = ({children, title = '时间余额不足'}: {children: ReactNode; title?: string}) => (
  <div style={{height: '100%', display: 'grid', gridTemplateColumns: '82px 1fr', background: theme.colors.paperWarm}}>
    <aside
      style={{
        borderRight: `1px solid ${theme.colors.line}`,
        background: 'rgba(255,255,255,0.72)',
        paddingTop: 36,
        display: 'grid',
        justifyItems: 'center',
        alignContent: 'start',
        gap: 28
      }}
    >
      {sidebarIcons.map((icon, index) => (
        <div
          key={icon}
          style={{
            width: 48,
            height: 48,
            borderRadius: 12,
            display: 'grid',
            placeItems: 'center',
            background: index === 3 ? theme.colors.pine : 'transparent',
            color: index === 3 ? theme.colors.white : theme.colors.muted,
            fontFamily: theme.fonts.serif,
            fontSize: 22
          }}
        >
          {icon}
        </div>
      ))}
    </aside>
    <main>
      <header
        style={{
          height: 72,
          display: 'flex',
          alignItems: 'center',
          gap: 22,
          padding: '0 34px',
          borderBottom: `1px solid ${theme.colors.line}`,
          background: 'rgba(255, 250, 244, 0.82)'
        }}
      >
        <span style={{fontFamily: theme.fonts.sans, color: theme.colors.muted, fontSize: 20}}>书架</span>
        <strong style={{fontFamily: theme.fonts.serif, fontSize: 28}}>{title}</strong>
        <ProgressBadge label="生成中" progress={55} />
      </header>
      {children}
    </main>
  </div>
);

const Label = ({children, inverse = false}: {children: ReactNode; inverse?: boolean}) => (
  <span
    style={{
      display: 'inline-flex',
      padding: '8px 12px',
      borderRadius: 999,
      border: inverse ? '1px solid rgba(255, 250, 244, 0.34)' : `1px solid ${theme.colors.line}`,
      background: inverse ? 'rgba(255, 250, 244, 0.18)' : 'rgba(95, 135, 111, 0.10)',
      color: inverse ? theme.colors.white : theme.colors.pineDark,
      fontFamily: theme.fonts.sans,
      fontSize: 14,
      fontWeight: 700
    }}
  >
    {children}
  </span>
);

const FormField = ({label, value, wide = false}: {label: string; value: string; wide?: boolean}) => (
  <div style={{gridColumn: wide ? '1 / -1' : undefined}}>
    <div style={{fontFamily: theme.fonts.sans, color: theme.colors.muted, fontSize: 17, marginBottom: 10}}>{label}</div>
    <div
      style={{
        minHeight: wide ? 118 : 54,
        borderRadius: 12,
        border: `1px solid ${theme.colors.line}`,
        background: theme.colors.white,
        padding: '15px 18px',
        fontFamily: theme.fonts.sans,
        fontSize: 21,
        color: theme.colors.ink,
        lineHeight: 1.55
      }}
    >
      {value}
    </div>
  </div>
);

export const BookshelfShot = () => (
  <div style={{height: '100%', padding: 72, background: theme.colors.paperWarm}}>
    <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
      <h1 style={{fontFamily: theme.fonts.serif, fontSize: 58, margin: 0}}>我的书架</h1>
      <button style={{border: 0, borderRadius: 13, background: theme.colors.pine, color: theme.colors.white, fontSize: 26, padding: '20px 34px'}}>
        新建作品
      </button>
    </div>
    <div style={{display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 34, marginTop: 72}}>
      {['时间余额不足', '镜中海', '远星回声'].map((title, index) => (
        <div key={title} style={{...card, height: 260, padding: 34}}>
          <h2 style={{fontFamily: theme.fonts.serif, fontSize: 38, margin: '0 0 22px'}}>{title}</h2>
          <ProgressBadge label={index === 0 ? '生成中' : '已完成'} progress={index === 0 ? 55 : undefined} tone={index === 0 ? 'orange' : 'green'} />
          <p style={{fontFamily: theme.fonts.sans, color: theme.colors.muted, fontSize: 22, marginTop: 34}}>逐章共创模式</p>
        </div>
      ))}
    </div>
  </div>
);

export const CreateProjectShot = () => (
  <div style={{height: '100%', display: 'grid', gridTemplateColumns: '0.58fr 1fr', background: theme.colors.paperWarm}}>
    <div style={{padding: '62px 50px', background: 'linear-gradient(135deg, rgba(95,135,111,0.10), rgba(255,250,244,0.56))'}}>
      <div style={{fontFamily: theme.fonts.sans, letterSpacing: '0.28em', color: theme.colors.muted, fontSize: 16, marginBottom: 32}}>CREATE BRIEF</div>
      <h1 style={{fontFamily: theme.fonts.serif, fontSize: 58, lineHeight: 1.12, margin: 0}}>新建创作项目</h1>
      <div style={{marginTop: 54, display: 'grid', gap: 18}}>
        {['1. 作品定位', '2. 创作 Brief', '3. 协作方式', '4. 确认创建'].map((step, index) => (
          <div
            key={step}
            style={{
              width: 'fit-content',
              padding: '15px 22px',
              borderRadius: 999,
              background: index === 1 ? theme.colors.pine : 'rgba(255,253,248,0.70)',
              color: index === 1 ? theme.colors.white : theme.colors.muted,
              border: `1px solid ${theme.colors.line}`,
              fontFamily: theme.fonts.sans,
              fontSize: 20
            }}
          >
            {step}
          </div>
        ))}
      </div>
    </div>
    <div style={{padding: '56px 62px'}}>
      <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24}}>
        <FormField label="内容类型" value="短篇小说" />
        <FormField label="协作模式" value="逐章共创" />
        <FormField label="小说名称" value="时间余额不足" />
        <FormField label="目标章节" value="1 - 4 章" />
        <FormField label="小说简介" wide value="一个被时间预算系统支配的城市里，普通职员林澈发现自己的剩余人生正在被项目管理工具逐日扣减。" />
      </div>
      <div style={{marginTop: 24, ...card, padding: 24}}>
        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
          <div>
            <h3 style={{fontFamily: theme.fonts.serif, margin: 0, fontSize: 28}}>作家风格</h3>
            <p style={{fontFamily: theme.fonts.sans, margin: '10px 0 0', color: theme.colors.muted, fontSize: 17}}>为 Planner / Writer / Reviser 注入统一风格。</p>
          </div>
          <Label>鲁迅 · 已选择</Label>
        </div>
      </div>
    </div>
  </div>
);

export const SkillShot = () => (
  <div style={{height: '100%', padding: '54px 70px', background: theme.colors.paperWarm}}>
    <h1 style={{fontFamily: theme.fonts.serif, fontSize: 52, margin: '0 0 12px'}}>选择作家风格</h1>
    <p style={{fontFamily: theme.fonts.sans, color: theme.colors.muted, fontSize: 21, margin: '0 0 34px'}}>同一项目只启用一个主风格，保证长篇气质稳定。</p>
    <div style={{display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 26}}>
      {[
        ['鲁迅', 'Lu Xun', '反讽、国民性批判、冷峻凝视。'],
        ['刘慈欣', 'Liu Cixin', '宏大尺度、技术奇观、文明命运。'],
        ['海明威', 'Hemingway', '克制短句、冰山原则、行动承载情绪。']
      ].map(([name, en, desc], index) => (
        <div
          key={name}
          style={{
            ...card,
            minHeight: 324,
            padding: 30,
            background: index === 0 ? theme.colors.pine : 'rgba(255,253,248,0.88)',
            color: index === 0 ? theme.colors.white : theme.colors.ink,
            transform: index === 0 ? 'translateY(-8px)' : undefined
          }}
        >
          <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
            <h2 style={{fontFamily: theme.fonts.serif, fontSize: 34, margin: 0}}>{name}</h2>
            <Label inverse={index === 0}>{index === 0 ? '启用' : '可选'}</Label>
          </div>
          <div style={{fontFamily: theme.fonts.sans, opacity: 0.82, fontSize: 18, marginTop: 8}}>{en}</div>
          <p style={{fontFamily: theme.fonts.sans, fontSize: 21, lineHeight: 1.75, marginTop: 34, color: index === 0 ? 'rgba(255,250,244,0.86)' : theme.colors.muted}}>
            {desc}
          </p>
          <div style={{marginTop: 30, display: 'flex', gap: 10}}>
            <Label inverse={index === 0}>style_only</Label>
            <Label inverse={index === 0}>strength 70%</Label>
          </div>
        </div>
      ))}
    </div>
  </div>
);

export const PlanningShot = () => (
  <Shell title="时间余额不足">
    <div style={{padding: '44px 56px', position: 'relative', height: '100%', boxSizing: 'border-box'}}>
      <div style={{display: 'grid', gridTemplateColumns: '1.1fr 0.9fr', gap: 28}}>
        <section style={{...card, padding: 34}}>
          <Label>AI 策划草案</Label>
          <h1 style={{fontFamily: theme.fonts.serif, fontSize: 42, margin: '24px 0'}}>四章故事结构</h1>
          {['时间余额系统的日常压迫', '母亲旧案与项目异常', '公司地下档案室', '时间债务的反击'].map((chapter, index) => (
            <div key={chapter} style={{padding: '16px 0', borderTop: index === 0 ? 'none' : `1px solid ${theme.colors.line}`}}>
              <strong style={{fontFamily: theme.fonts.serif, fontSize: 24}}>第 {index + 1} 章</strong>
              <span style={{fontFamily: theme.fonts.sans, color: theme.colors.muted, fontSize: 20, marginLeft: 18}}>{chapter}</span>
            </div>
          ))}
        </section>
        <section style={{...card, padding: 34}}>
          <Label>Planner / Writer / Reviser</Label>
          <h2 style={{fontFamily: theme.fonts.serif, fontSize: 36, margin: '24px 0 22px'}}>风格层已注入</h2>
          {['叙事结构', '表达 DNA', '修订约束'].map((item, index) => (
            <div key={item} style={{display: 'grid', gridTemplateColumns: '120px 1fr', gap: 18, alignItems: 'center', marginBottom: 20, fontFamily: theme.fonts.sans}}>
              <span style={{fontSize: 18, color: theme.colors.muted}}>{item}</span>
              <div style={{height: 12, borderRadius: 999, background: 'rgba(95,135,111,0.12)'}}>
                <div style={{height: '100%', width: `${82 - index * 8}%`, borderRadius: 999, background: theme.colors.pine}} />
              </div>
            </div>
          ))}
        </section>
      </div>
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          transform: 'translate(-50%, -50%)',
          width: 520,
          padding: 34,
          borderRadius: 20,
          background: 'rgba(255,253,248,0.98)',
          border: `1px solid ${theme.colors.line}`,
          boxShadow: theme.shadow,
          textAlign: 'center'
        }}
      >
        <h2 style={{fontFamily: theme.fonts.serif, fontSize: 34, margin: '0 0 14px'}}>确认策划方向</h2>
        <p style={{fontFamily: theme.fonts.sans, fontSize: 19, color: theme.colors.muted, lineHeight: 1.7, margin: 0}}>确认后进入逐章共创，AI 将按此大纲生成章节。</p>
        <button style={{marginTop: 26, border: 0, borderRadius: 12, padding: '16px 30px', background: theme.colors.pine, color: theme.colors.white, fontSize: 22}}>通过策划</button>
      </div>
    </div>
  </Shell>
);

export const WorkflowShot = ({confirmMode = false}: {confirmMode?: boolean}) => {
  const frame = useCurrentFrame();
  const progress = interpolate(frame, [0, 260], [35, confirmMode ? 72 : 62], {extrapolateRight: 'clamp'});

  return (
    <Shell title="时间余额不足">
      <div style={{height: '100%', padding: '48px 58px', boxSizing: 'border-box', position: 'relative'}}>
        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 34}}>
          <div>
            <Label>第 2 章 · 逐章共创</Label>
            <h1 style={{fontFamily: theme.fonts.serif, fontSize: 44, margin: '18px 0 0'}}>母亲旧案与项目异常</h1>
          </div>
          <ProgressBadge label={confirmMode ? '待确认' : '生成中'} progress={progress} tone={confirmMode ? 'green' : 'orange'} />
        </div>
        <div style={{display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 18}}>
          {[
            ['Context', '装配世界观与前文状态'],
            ['Writer', '生成章节初稿'],
            ['Critic', '按质量标尺评审'],
            ['Reviser', '局部修订与扩写'],
            ['Human', '人工确认后续章']
          ].map(([name, desc], index) => (
            <div key={name} style={{...card, minHeight: 250, padding: 24, background: index < (confirmMode ? 5 : 4) ? 'rgba(239,247,241,0.92)' : theme.colors.white}}>
              <div style={{width: 46, height: 46, borderRadius: 13, background: index < (confirmMode ? 5 : 4) ? theme.colors.pine : 'rgba(95,135,111,0.12)', color: index < (confirmMode ? 5 : 4) ? theme.colors.white : theme.colors.muted, display: 'grid', placeItems: 'center', fontFamily: theme.fonts.sans, fontWeight: 800}}>
                {index + 1}
              </div>
              <h2 style={{fontFamily: theme.fonts.serif, fontSize: 28, margin: '28px 0 14px'}}>{name}</h2>
              <p style={{fontFamily: theme.fonts.sans, fontSize: 18, color: theme.colors.muted, lineHeight: 1.6, margin: 0}}>{desc}</p>
            </div>
          ))}
        </div>
        <section style={{...card, marginTop: 26, padding: 26, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 22}}>
          {['质量评分 8.7/10', '字数门控 1120 字', '问题定位 2 处已修复'].map((item) => (
            <div key={item} style={{fontFamily: theme.fonts.sans, fontSize: 21, color: theme.colors.pineDark}}>{item}</div>
          ))}
        </section>
        {confirmMode ? (
          <div
            style={{
              position: 'absolute',
              left: '50%',
              top: '50%',
              transform: 'translate(-50%, -50%)',
              width: 560,
              padding: 34,
              borderRadius: 20,
              background: 'rgba(255,253,248,0.98)',
              border: `1px solid ${theme.colors.line}`,
              boxShadow: theme.shadow,
              textAlign: 'center'
            }}
          >
            <h2 style={{fontFamily: theme.fonts.serif, fontSize: 34, margin: '0 0 14px'}}>第 2 章等待确认</h2>
            <p style={{fontFamily: theme.fonts.sans, fontSize: 19, color: theme.colors.muted, lineHeight: 1.7, margin: 0}}>通过后自动进入第 3 章，也可以退回修改意见。</p>
            <div style={{marginTop: 26, display: 'flex', justifyContent: 'center', gap: 16}}>
              <button style={{border: `1px solid ${theme.colors.line}`, borderRadius: 12, padding: '15px 26px', background: theme.colors.white, color: theme.colors.ink, fontSize: 20}}>提出修改</button>
              <button style={{border: 0, borderRadius: 12, padding: '15px 30px', background: theme.colors.pine, color: theme.colors.white, fontSize: 20}}>确认通过</button>
            </div>
          </div>
        ) : null}
      </div>
    </Shell>
  );
};

export const ReaderShot = () => (
  <Shell title="时间余额不足">
    <div style={{height: '100%', padding: '34px 94px', boxSizing: 'border-box', background: '#fbf6ef'}}>
      <header style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `1px solid ${theme.colors.line}`, paddingBottom: 20}}>
        <div>
          <h1 style={{fontFamily: theme.fonts.serif, fontSize: 38, margin: 0}}>第 1 章 一模考场上的猝死与重生</h1>
          <p style={{fontFamily: theme.fonts.sans, color: theme.colors.muted, fontSize: 17, margin: '8px 0 0'}}>时间余额不足</p>
        </div>
        <div style={{display: 'flex', gap: 12}}>
          <button style={{border: `1px solid ${theme.colors.line}`, borderRadius: 12, background: theme.colors.white, padding: '12px 22px', fontSize: 18}}>编辑</button>
          <button style={{border: `1px solid ${theme.colors.line}`, borderRadius: 12, background: theme.colors.white, padding: '12px 22px', fontSize: 18}}>章节</button>
        </div>
      </header>
      <article style={{maxWidth: 970, margin: '44px auto 0', fontFamily: theme.fonts.serif, fontSize: 30, lineHeight: 1.95, color: theme.colors.ink}}>
        <p>荧光灯的冷光像刀片一样刮着视网膜，林澈的手指还粘在机械键盘的空格键上，烫得发麻。</p>
        <p>屏幕上的弹窗还在闪烁：优化通知——林澈，您的劳动合同将于本月底终止，请于三日内办理离职手续。</p>
        <p>手边的速溶咖啡杯已经空了三天，杯壁上结着一层褐色的垢，像他熬了三个月的项目进度条。</p>
      </article>
      <div style={{position: 'absolute', left: '50%', bottom: 34, transform: 'translateX(-50%)', borderRadius: 999, background: 'rgba(62,52,44,0.72)', color: theme.colors.white, padding: '14px 32px', fontFamily: theme.fonts.sans, fontSize: 20}}>
        1 / 12
      </div>
    </div>
  </Shell>
);

export const QualityShot = () => (
  <Shell title="时间余额不足">
    <div style={{height: '100%', padding: '50px 60px', boxSizing: 'border-box'}}>
      <h1 style={{fontFamily: theme.fonts.serif, fontSize: 46, margin: '0 0 30px'}}>质量分析</h1>
      <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 24}}>
        {[
          ['总体质量', '8.7/10', 87],
          ['结构完成度', '91%', 91],
          ['风格一致性', '84%', 84]
        ].map(([label, value, width]) => (
          <div key={label} style={{...card, padding: 30}}>
            <div style={{fontFamily: theme.fonts.sans, color: theme.colors.muted, fontSize: 20}}>{label}</div>
            <div style={{fontFamily: theme.fonts.serif, fontSize: 48, margin: '18px 0'}}>{value}</div>
            <div style={{height: 10, borderRadius: 999, background: 'rgba(95,135,111,0.12)'}}>
              <div style={{height: '100%', width: `${width}%`, borderRadius: 999, background: theme.colors.pine}} />
            </div>
          </div>
        ))}
      </div>
      <div style={{display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: 24, marginTop: 24}}>
        <div style={{...card, padding: 30}}>
          <h2 style={{fontFamily: theme.fonts.serif, fontSize: 32, margin: '0 0 18px'}}>问题定位</h2>
          {['第 2 章中段节奏偏快，已触发局部修订。', '结尾悬念钩子不足，已补强。', '字数门控通过，章节处于目标区间。'].map((item) => (
            <div key={item} style={{fontFamily: theme.fonts.sans, fontSize: 20, color: theme.colors.muted, padding: '12px 0', borderTop: `1px solid ${theme.colors.line}`}}>{item}</div>
          ))}
        </div>
        <ExportShot />
      </div>
    </div>
  </Shell>
);

export const ExportShot = () => (
  <div style={{...card, padding: 30}}>
    <h2 style={{fontFamily: theme.fonts.serif, fontSize: 32, margin: '0 0 18px'}}>导出分享</h2>
    {['TXT', 'DOCX', 'PDF'].map((format) => (
      <div key={format} style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontFamily: theme.fonts.sans, fontSize: 20, padding: '14px 0', borderTop: `1px solid ${theme.colors.line}`}}>
        <span>{format}</span>
        <span style={{color: theme.colors.pineDark}}>可下载</span>
      </div>
    ))}
    <button style={{marginTop: 20, width: '100%', border: 0, borderRadius: 12, background: theme.colors.pine, color: theme.colors.white, padding: '16px 0', fontSize: 21}}>
      生成交付文件
    </button>
  </div>
);
