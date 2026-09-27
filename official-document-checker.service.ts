export type IssueSeverity = 'error' | 'warning' | 'info';

export interface DocumentIssue {
  severity: IssueSeverity;
  category: string;
  message: string;
  suggestion: string;
  excerpt?: string;
}

export interface FormattingRule {
  item: string;
  detail: string;
}

/** 规范化的公文结尾文种（参照《党政机关公文处理工作条例》中的 15 类法定文种） */
const DOCUMENT_TYPES = ['通知', '通报', '报告', '请示', '批复', '决定', '意见', '函', '纪要', '公告', '通告', '命令', '议案'];

/** 常见不规范用词纠正表 */
const WORD_SUGGESTIONS: { bad: string; good: string }[] = [
  { bad: '做为', good: '作为' },
  { bad: '帐号', good: '账号' },
  { bad: '记帐', good: '记账' },
  { bad: '其它', good: '其他' },
  { bad: '倍受', good: '备受' },
  { bad: '按装', good: '安装' },
  { bad: '既使', good: '即使' },
];

/** 需在 Word / WPS 中人工确认的排版规格（参照 GB/T 9704-2012） */
export const FORMATTING_RULES: FormattingRule[] = [
  { item: '用纸与页边距', detail: 'A4 纸（210mm×297mm）；页边距一般为上 37mm、下 35mm、左 28mm、右 26mm。' },
  { item: '标题', detail: '一般用 2 号小标宋体字，居中排布；标题中除法规、规章名称加书名号外，一般不用标点符号。' },
  { item: '主送机关', detail: '标题下空一行，左侧顶格用 3 号仿宋体字编排，回行仍顶格，末尾用全角冒号。' },
  { item: '正文', detail: '一般用 3 号仿宋体字；每个自然段左缩进二字，结构层次序数依次为「一、」「（一）」「1.」「（1）」。' },
  { item: '行数与字数', detail: '一般每面排 22 行，每行 28 字，行距可设为固定值约 28 磅。' },
  { item: '成文日期', detail: '用阿拉伯数字将年、月、日标全，例如「2026年9月27日」，不得写为「2026.9.27」或「二〇二六年」。' },
];

/** 供「填入示例」使用的典型问题公文，便于课堂演示 */
export const EXAMPLE_DOCUMENT = `关于开展社团招新活动的
各学生社团,大家好:
　　为进一步丰富校园文化生活,现就有关事项安排如下。
　　（一）招新时间
　　本次活动大概在十月中旬举行,请各社团做为协办单位做好准备。
其它注意事项请等待后续通知。。
　　当否,请批示!!
学生社团联合会
2026.9.27`;

const CJK_PUNCTUATION_HALF_WIDTH = /[\u4e00-\u9fa5][,;:!?]|[,;:!?][\u4e00-\u9fa5]|[\u4e00-\u9fa5]\.(?!\d)/g;

const excerptAt = (text: string, index: number, radius = 8): string => {
  const start = Math.max(0, index - radius);
  const end = Math.min(text.length, index + radius);
  return text.slice(start, end).replace(/\s+/g, ' ');
};

const severityWeight = (severity: IssueSeverity): number => {
  if (severity === 'error') return 0;
  if (severity === 'warning') return 1;
  return 2;
};

/**
 * 对粘贴的公文全文进行格式自检，全部规则在浏览器本地运行。
 * 返回按严重程度排序的问题清单。
 */
export const checkDocument = (input: string): DocumentIssue[] => {
  const issues: DocumentIssue[] = [];
  const text = input ?? '';

  if (!text.trim()) {
    return [
      {
        severity: 'error',
        category: '全文',
        message: '还没有粘贴任何公文内容。',
        suggestion: '请将完整公文（含标题、主送机关、正文、落款与日期）粘贴到左侧文本框后再自检。',
      },
    ];
  }

  const lines = text
    .split(/\r?\n/)
    .map((line, index) => ({ index: index + 1, raw: line, content: line.trim() }))
    .filter(line => line.content.length > 0);

  const title = lines[0]?.content ?? '';
  const recipient = lines[1]?.content;

  // 一、标题检查
  const endsWithDocumentType = DOCUMENT_TYPES.some(type => title.endsWith(type));
  if (!endsWithDocumentType) {
    issues.push({
      severity: 'error',
      category: '标题',
      message: '标题结尾缺少规范的公文文种。',
      suggestion: `公文标题一般由「发文机关 + 事由 + 文种」构成，结尾应是规范文种（如：${DOCUMENT_TYPES.join('、')}）。例如「关于开展秋季招新工作的通知」。`,
      excerpt: title,
    });
  }
  if ([...title].length > 50) {
    issues.push({
      severity: 'warning',
      category: '标题',
      message: `标题偏长（${[...title].length} 字），一般不宜超过 50 字。`,
      suggestion: '精简事由，标题中不使用换行、逗号额外断句；确需换行时保持词意完整、排列对称。',
      excerpt: title,
    });
  }
  if (/[。！？，；：、]$/.test(title)) {
    issues.push({
      severity: 'error',
      category: '标题',
      message: '标题末尾不应使用标点符号。',
      suggestion: '删除标题末尾的标点；标题中除法规、规章名称使用书名号外，一般不加标点。',
      excerpt: title,
    });
  }
  if (title.includes('请示报告')) {
    issues.push({
      severity: 'error',
      category: '标题',
      message: '「请示」与「报告」是两个不同文种，不能并用。',
      suggestion: '需要上级批复的事项用「请示」（一文一事）；汇报工作、反映情况用「报告」。',
      excerpt: title,
    });
  }

  // 二、主送机关检查
  if (recipient) {
    if (recipient.endsWith(':')) {
      issues.push({
        severity: 'error',
        category: '主送机关',
        message: '主送机关末尾使用了半角冒号。',
        suggestion: '应使用全角冒号「：」，并顶格书写，例如「各学生社团：」。',
        excerpt: recipient,
      });
    } else if (!recipient.endsWith('：')) {
      issues.push({
        severity: 'warning',
        category: '主送机关',
        message: '标题下方第一行疑似主送机关，但未以全角冒号结尾。',
        suggestion: '主送机关应顶格书写并以「：」结束（公告、通告等无主送机关的文种可忽略本条）。',
        excerpt: recipient,
      });
    }
    if (/^\s/.test(lines[1]?.raw ?? '')) {
      issues.push({
        severity: 'warning',
        category: '主送机关',
        message: '主送机关前存在缩进空格。',
        suggestion: '主送机关应顶格编排，不要缩进；需要缩进的是正文自然段（首行缩进二字）。',
        excerpt: recipient,
      });
    }
  }

  // 三、层次序数检查
  const bodyText = lines.slice(1).map(line => line.content).join('\n');
  const hasLevel1 = /^[一二三四五六七八九十百]+、/m.test(bodyText);
  const hasLevel2 = /^（[一二三四五六七八九十]+）/m.test(bodyText);
  const hasLevel3 = /^\d+[.．]/m.test(bodyText);
  const hasLevel4 = /^（\d+）/m.test(bodyText);
  if (hasLevel2 && !hasLevel1) {
    issues.push({
      severity: 'warning',
      category: '层次序号',
      message: '正文中出现了「（一）」层级，但未出现「一、」层级，可能跳级。',
      suggestion: '层次序数应依次为「一、」→「（一）」→「1.」→「（1）」，不要越级使用。',
    });
  }
  if (hasLevel3 && !hasLevel2) {
    issues.push({
      severity: 'warning',
      category: '层次序号',
      message: '正文中出现了「1.」层级，但未出现「（一）」层级，可能跳级。',
      suggestion: '阿拉伯数字序号前应先使用「（一）」这一层级。',
    });
  }
  if (hasLevel4 && !hasLevel3) {
    issues.push({
      severity: 'warning',
      category: '层次序号',
      message: '正文中出现了「（1）」层级，但未出现「1.」层级，可能跳级。',
      suggestion: '「（1）」是第四层序号，其前应有「1.」层级。',
    });
  }
  const dotAfterNumber = bodyText.match(/^\d+、/m);
  if (dotAfterNumber) {
    issues.push({
      severity: 'warning',
      category: '层次序号',
      message: `发现「${dotAfterNumber[0]}」写法，第三层序号应使用小圆点。`,
      suggestion: '将「1、」改为「1.」（英文小圆点），例如「1. 报名方式」。',
    });
  }

  // 四、标点符号检查
  const halfWidthMatches = [...text.matchAll(CJK_PUNCTUATION_HALF_WIDTH)];
  if (halfWidthMatches.length > 0) {
    const samples = halfWidthMatches.slice(0, 3).map(match => `「${excerptAt(text, match.index ?? 0)}」`);
    issues.push({
      severity: 'warning',
      category: '标点符号',
      message: `发现 ${halfWidthMatches.length} 处中文语境中使用半角标点。`,
      suggestion: `公文应使用全角中文标点（，。；：？！），请切换中文输入法后修改。位置示例：${samples.join('、')}。`,
    });
  }
  if (/[！？!]{2,}/.test(text)) {
    issues.push({
      severity: 'warning',
      category: '标点符号',
      message: '出现了连用的感叹号或问号。',
      suggestion: '公文语言应庄重平实，避免使用「！！」「??」等连用标点。',
    });
  }
  if (/。{2,}/.test(text)) {
    issues.push({
      severity: 'error',
      category: '标点符号',
      message: '出现了连用的句号。',
      suggestion: '删除多余的句号；表示列举省略应使用「……」，而不是「。。」。',
    });
  }
  if (/\.{3,}|．{3,}/.test(text)) {
    issues.push({
      severity: 'warning',
      category: '标点符号',
      message: '疑似使用了不规范的省略号写法。',
      suggestion: '中文省略号为六个居中小点「……」（Shift + 6），不要写成「...」或「。。。」。',
    });
  }
  const leftQuotes = (text.match(/“/g) ?? []).length;
  const rightQuotes = (text.match(/”/g) ?? []).length;
  if (leftQuotes !== rightQuotes) {
    issues.push({
      severity: 'warning',
      category: '标点符号',
      message: `中文引号不配对（左引号 ${leftQuotes} 个，右引号 ${rightQuotes} 个）。`,
      suggestion: '检查是否漏写或误写了成对引号「」“”。',
    });
  }
  const leftParens = (text.match(/（/g) ?? []).length;
  const rightParens = (text.match(/）/g) ?? []).length;
  if (leftParens !== rightParens) {
    issues.push({
      severity: 'warning',
      category: '标点符号',
      message: `中文括号不配对（左括号 ${leftParens} 个，右括号 ${rightParens} 个）。`,
      suggestion: '检查是否漏写了「（」或「）」。',
    });
  }

  // 五、用词检查
  WORD_SUGGESTIONS.forEach(({ bad, good }) => {
    const count = text.split(bad).length - 1;
    if (count > 0) {
      const index = text.indexOf(bad);
      issues.push({
        severity: 'warning',
        category: '用词规范',
        message: `「${bad}」出现 ${count} 次，规范词形应为「${good}」。`,
        suggestion: `请将「${bad}」统一替换为「${good}」。`,
        excerpt: excerptAt(text, index),
      });
    }
  });
  const vagueCount = (text.match(/大概|差不多|也许|可能是/g) ?? []).length;
  if (vagueCount > 0) {
    issues.push({
      severity: 'info',
      category: '用词规范',
      message: `发现 ${vagueCount} 处模糊表述。`,
      suggestion: '公文内容应准确、肯定，时间、数量、责任主体要明确，尽量将「大概、差不多、也许」改为具体信息或「拟、约、暂定」等规范表述。',
    });
  }

  // 六、成文日期检查
  if (/\d{4}\s*[.．\-/]\s*\d{1,2}\s*[.．\-/]\s*\d{1,2}/.test(text)) {
    const match = text.match(/\d{4}\s*[.．\-/]\s*\d{1,2}\s*[.．\-/]\s*\d{1,2}/);
    issues.push({
      severity: 'error',
      category: '成文日期',
      message: '成文日期使用了点号或短横线格式。',
      suggestion: '成文日期应用阿拉伯数字将年、月、日标全，例如「2026年9月27日」，不能写为「2026.9.27」「2026-9-27」。',
      excerpt: match?.[0],
    });
  } else if (/[〇○零一二三四五六七八九十]{4}年/.test(text)) {
    const match = text.match(/.{0,4}[〇○零一二三四五六七八九十]{4}年.{0,8}/);
    issues.push({
      severity: 'error',
      category: '成文日期',
      message: '成文日期使用了汉字数字。',
      suggestion: '成文日期应使用阿拉伯数字，例如「二〇二六年九月二十七日」应改为「2026年9月27日」。',
      excerpt: match?.[0],
    });
  } else if (!/\d{4}\s*年\s*\d{1,2}\s*月\s*\d{1,2}\s*日/.test(text)) {
    issues.push({
      severity: 'warning',
      category: '成文日期',
      message: '全文未检测到规范的成文日期。',
      suggestion: '公文末尾应标注成文日期，格式为「2026年9月27日」，与发文机关署名上下排布。',
    });
  }

  return issues.sort((a, b) => severityWeight(a.severity) - severityWeight(b.severity));
};
