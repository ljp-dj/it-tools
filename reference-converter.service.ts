export type ReferenceType = 'article' | 'book' | 'thesis' | 'chapter' | 'webpage';
export type CitationStyle = 'gbt7714' | 'apa';

export interface Reference {
  id: string;
  type: ReferenceType;
  title: string;
  /** 每位作者一行；中文直接写「张三」，英文写「John K Smith」或「Smith, John K」 */
  authors: string[];
  year: string;
  /** 期刊名 / 论文集名 */
  journal?: string;
  volume?: string;
  issue?: string;
  pages?: string;
  place?: string;
  publisher?: string;
  institution?: string;
  siteName?: string;
  url?: string;
  datePublished?: string;
  dateCited?: string;
  doi?: string;
  thesisLevel?: string;
}

export const REFERENCE_TYPES: { value: ReferenceType; label: string; tag: string }[] = [
  { value: 'article', label: '期刊论文', tag: 'J' },
  { value: 'book', label: '专著 / 图书', tag: 'M' },
  { value: 'thesis', label: '学位论文', tag: 'D' },
  { value: 'chapter', label: '论文集析出文献', tag: 'C' },
  { value: 'webpage', label: '电子资源 / 网页', tag: 'EB/OL' },
];

export const TYPE_TAG: Record<ReferenceType, string> = {
  article: 'J',
  book: 'M',
  thesis: 'D',
  chapter: 'C',
  webpage: 'EB/OL',
};

const CJK = /[\u4e00-\u9fa5]/;
const MAX_AUTHORS = 3;

interface PersonName {
  isChinese: boolean;
  family: string;
  givenTokens: string[];
}

/** 解析单个作者姓名：支持「张三」「John K Smith」「Smith, John K」三种写法 */
const parsePerson = (raw: string): PersonName | null => {
  const name = raw.trim();
  if (!name) {
    return null;
  }
  if (CJK.test(name)) {
    return { isChinese: true, family: name, givenTokens: [] };
  }
  if (name.includes(',')) {
    const [family, ...given] = name.split(',');
    return {
      isChinese: false,
      family: family.trim(),
      givenTokens: given.join(',').split(/\s+/).filter(Boolean),
    };
  }
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length === 1) {
    return { isChinese: false, family: parts[0], givenTokens: [] };
  }
  return {
    isChinese: false,
    family: parts[parts.length - 1],
    givenTokens: parts.slice(0, -1),
  };
};

/** GB/T 7714 作者：英文姓全大写、名取首字母；超过 3 位只列前 3 位加「等 / et al」 */
const formatAuthorsGbt = (authors: string[]): string => {
  const people = authors.map(parsePerson).filter((p): p is PersonName => p !== null);
  if (people.length === 0) {
    return '';
  }
  const hasChinese = people.some(p => p.isChinese);
  const shown = people.slice(0, MAX_AUTHORS);
  const text = shown
    .map(p => {
      if (p.isChinese) {
        return p.family;
      }
      const initials = p.givenTokens.map(token => token[0]?.toUpperCase() ?? '').join(' ');
      return `${p.family.toUpperCase()}${initials ? ` ${initials}` : ''}`;
    })
    .join(', ');
  if (people.length > MAX_AUTHORS) {
    return `${text}, ${hasChinese ? '等' : 'et al'}`;
  }
  return text;
};

/** APA 7 作者：Zhang, S. / Smith, J. K.；英文作者最后一位前加 &，中文作者用逗号并列 */
const formatAuthorsApa = (authors: string[]): string => {
  const people = authors.map(parsePerson).filter((p): p is PersonName => p !== null);
  if (people.length === 0) {
    return '';
  }
  const allChinese = people.every(p => p.isChinese);
  const formatOne = (p: PersonName) => {
    if (p.isChinese) {
      return p.family;
    }
    const initials = p.givenTokens.map(token => `${token[0]?.toUpperCase() ?? ''}.`).join(' ');
    return initials ? `${p.family}, ${initials}` : p.family;
  };
  if (people.length === 1) {
    return formatOne(people[0]);
  }
  if (allChinese) {
    return people.map(formatOne).join(', ');
  }
  const head = people.slice(0, -1).map(formatOne).join(', ');
  return `${head}, & ${formatOne(people[people.length - 1])}`;
};

const clean = (value?: string) => value?.trim() ?? '';
const endDot = (value: string) => (value && !value.endsWith('.') ? `${value}.` : value);
const doiUrl = (doi: string) => (doi.startsWith('http') ? doi : `https://doi.org/${doi.replace(/^DOI:\s*/i, '')}`);

/** GB/T 7714-2015 单条文献格式化 */
const formatGbt = (ref: Reference, index: number): string => {
  const tag = TYPE_TAG[ref.type];
  const authorPart = formatAuthorsGbt(ref.authors);
  const prefix = authorPart ? `${authorPart}. ` : '';
  const year = clean(ref.year);
  const doi = clean(ref.doi);
  const parts: string[] = [];

  if (ref.type === 'article') {
    parts.push(`${prefix}${ref.title.trim()}[${tag}]. ${clean(ref.journal)}, ${year}`);
    const volume = clean(ref.volume);
    const issue = clean(ref.issue);
    const pages = clean(ref.pages);
    let tail = '';
    if (volume) {
      tail = `, ${volume}`;
      if (issue) {
        tail += `(${issue})`;
      }
      if (pages) {
        tail += `: ${pages}`;
      }
    } else if (issue) {
      tail = `, (${issue})`;
      if (pages) {
        tail += `: ${pages}`;
      }
    } else if (pages) {
      tail = `: ${pages}`;
    }
    parts[0] += tail;
  } else if (ref.type === 'book') {
    const place = clean(ref.place);
    const publisher = clean(ref.publisher);
    let tail = '';
    if (place && publisher) {
      tail = ` ${place}: ${publisher}, ${year}`;
    } else if (publisher) {
      tail = ` ${publisher}, ${year}`;
    } else {
      tail = `, ${year}`;
    }
    parts.push(`${prefix}${ref.title.trim()}[${tag}].${tail}`);
  } else if (ref.type === 'thesis') {
    const place = clean(ref.place);
    const institution = clean(ref.institution);
    let tail = '';
    if (place && institution) {
      tail = ` ${place}: ${institution}, ${year}`;
    } else if (institution) {
      tail = ` ${institution}, ${year}`;
    } else {
      tail = `, ${year}`;
    }
    parts.push(`${prefix}${ref.title.trim()}[${tag}].${tail}`);
  } else if (ref.type === 'chapter') {
    const place = clean(ref.place);
    const publisher = clean(ref.publisher);
    const pages = clean(ref.pages);
    let tail = `${prefix}${ref.title.trim()}[${tag}]//${clean(ref.journal)}`;
    if (place && publisher) {
      tail += `. ${place}: ${publisher}, ${year}`;
    } else if (publisher) {
      tail += `. ${publisher}, ${year}`;
    } else {
      tail += `, ${year}`;
    }
    if (pages) {
      tail += `: ${pages}`;
    }
    parts.push(tail);
  } else {
    // 电子资源 [EB/OL]
    let tail = `${prefix}${ref.title.trim()}[${tag}]`;
    const published = clean(ref.datePublished);
    const cited = clean(ref.dateCited);
    if (published) {
      tail += `. (${published})`;
    }
    if (cited) {
      tail += `[${cited}]`;
    }
    tail += `. ${clean(ref.url)}`;
    parts.push(tail);
  }

  let line = endDot(parts[0]);
  if (doi) {
    line += ` DOI: ${doi.replace(/^DOI:\s*/i, '')}.`;
  }
  return `[${index + 1}] ${line}`;
};

/** APA 7 单条文献格式化 */
const formatApa = (ref: Reference): string => {
  const authorPart = formatAuthorsApa(ref.authors);
  const year = clean(ref.year) || 'n.d.';
  const doi = clean(ref.doi);
  const url = clean(ref.url);
  const head = authorPart ? `${authorPart}. (${year}).` : `(${year}).`;
  const titlePart = authorPart ? `${head} ${ref.title.trim()}.` : `${ref.title.trim()}. ${head}`;
  let body = '';

  if (ref.type === 'article') {
    const volume = clean(ref.volume);
    const issue = clean(ref.issue);
    const pages = clean(ref.pages);
    let source = clean(ref.journal);
    if (volume) {
      source += `, ${volume}`;
      if (issue) {
        source += `(${issue})`;
      }
    } else if (issue) {
      source += `, (${issue})`;
    }
    if (pages) {
      source += `, ${pages}`;
    }
    body = `${titlePart} ${source}.`;
    if (doi) {
      body += ` ${doiUrl(doi)}`;
    }
  } else if (ref.type === 'book') {
    body = `${titlePart} ${clean(ref.publisher) || 'Unknown publisher'}.`;
    if (doi) {
      body += ` ${doiUrl(doi)}`;
    } else if (url) {
      body += ` ${url}`;
    }
  } else if (ref.type === 'thesis') {
    const level = clean(ref.thesisLevel) || (ref.title.includes('博') ? 'Doctoral dissertation' : "Master's thesis");
    const lead = authorPart ? `${head} ${ref.title.trim()}` : `${ref.title.trim()}. ${head}`;
    body = `${lead} [${level}, ${clean(ref.institution) || 'unlisted institution'}].`;
    if (url) {
      body += ` ${url}`;
    }
  } else if (ref.type === 'chapter') {
    const pages = clean(ref.pages);
    const bookPart = `In ${clean(ref.journal)}${pages ? ` (pp. ${pages})` : ''}`;
    body = `${titlePart} ${bookPart}. ${clean(ref.publisher) || 'Unknown publisher'}.`;
  } else {
    const published = clean(ref.datePublished);
    const dateStr = published ? `(${published}).` : `(${year}).`;
    const site = clean(ref.siteName);
    if (authorPart) {
      body = `${authorPart}. ${dateStr} ${ref.title.trim()}.`;
    } else {
      body = `${ref.title.trim()}. ${dateStr}`;
    }
    if (site) {
      body += ` ${site}.`;
    }
    if (url) {
      body += ` ${url}`;
    }
  }

  return body.replace(/\.{2,}/g, '.').replace(/\s+\./g, '.').trim();
};

/** 按列表顺序批量格式化；GB/T 7714 采用顺序编码制自动加 [n] */
export const formatReferences = (refs: Reference[], style: CitationStyle): string[] =>
  refs.map((ref, index) => (style === 'gbt7714' ? formatGbt(ref, index) : formatApa(ref)));
