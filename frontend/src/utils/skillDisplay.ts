interface AuthorNameParts {
  chinese: string
  english: string
}

export function extractAuthorNameParts(name: string): AuthorNameParts {
  const parts = name.split(/\s*[|｜]\s*/)
  const chinesePart = parts[0].trim()
  const englishPart = parts[1] || ''

  const authorMap: Record<string, [string, string]> = {
    fenghuo: ['烽火戏诸侯', 'Fenghuo Xizhuhou'],
    fenghuoxizhuhou: ['烽火戏诸侯', 'Fenghuo Xizhuhou'],
    huwei: ['狐尾的笔', 'Huwei De Bi'],
    huweidebi: ['狐尾的笔', 'Huwei De Bi'],
    yuyuzhu: ['郁雨竹', 'Yu Yuzhu'],
    jinyong: ['金庸', 'Jin Yong'],
    liudanpashui: ['榴弹怕水', 'Liudan Pashui'],
    maopu: ['猫腻', 'Mao Ni'],
    wangzengqi: ['汪曾祺', 'Wang Zengqi'],
    zhangdada: ['张大大', 'Zhang Dada'],
    chenzhongshi: ['陈忠实', 'Chen Zhongshi'],
    luxun: ['鲁迅', 'Lu Xun'],
    murakami: ['村上春树', 'Haruki Murakami'],
    rowling: ['J.K.罗琳', 'J.K. Rowling'],
    jkrowling: ['J.K.罗琳', 'J.K. Rowling'],
    cixin: ['刘慈欣', 'Liu Cixin'],
    liucixin: ['刘慈欣', 'Liu Cixin'],
    tangjiashao: ['唐家三少', 'Tang Jia San Shao'],
  }

  if (name.includes('-perspective') || name.includes('_perspective')) {
    const slug = name.toLowerCase().replace(/[-_](perspective|style)$/, '').replace(/[-_]/g, '')
    if (authorMap[slug]) {
      return { chinese: authorMap[slug][0], english: authorMap[slug][1] }
    }
    for (const [key, [chinese, english]] of Object.entries(authorMap)) {
      if (slug.includes(key)) return { chinese, english }
    }
  }

  const chinese = chinesePart
    .replace(/的?视角$/, '')
    .replace(/的?思维操作系统$/, '')
    .replace(/的?风格系统$/, '')
    .replace(/的?创作思维$/, '')
    .replace(/的?写作系统$/, '')
    .replace(/的?文风系统$/, '')
    .trim()

  for (const [, [mapChinese, mapEnglish]] of Object.entries(authorMap)) {
    if (chinese === mapChinese || chinese.includes(mapChinese) || mapChinese.includes(chinese)) {
      return { chinese: mapChinese, english: mapEnglish }
    }
  }

  const english = englishPart
    .replace(/\s*(Perspective|Style|System)$/i, '')
    .trim() || chinese

  return { chinese, english }
}
