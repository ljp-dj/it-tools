import { describe, expect, it } from 'vitest';
import { formatReferences, type Reference } from './reference-converter.service';

const base: Reference = {
  id: 'test',
  type: 'article',
  title: '',
  authors: [],
  year: '',
};

describe('reference-converter: GB/T 7714-2015', () => {
  it('中文期刊论文格式正确（卷期页齐全）', () => {
    const [line] = formatReferences(
      [{ ...base, title: '人工智能研究', authors: ['张三', '李四'], year: '2024', journal: '计算机学报', volume: '47', issue: '3', pages: '101-110' }],
      'gbt7714',
    );
    expect(line).toBe('[1] 张三, 李四. 人工智能研究[J]. 计算机学报, 2024, 47(3): 101-110.');
  });

  it('英文作者姓全大写、名缩写', () => {
    const [line] = formatReferences(
      [{ ...base, title: 'Deep learning methods', authors: ['John K Smith', 'Meng Wang'], year: '2023', journal: 'Nature', volume: '612', pages: '45-50' }],
      'gbt7714',
    );
    expect(line).toBe('[1] SMITH J K, WANG M. Deep learning methods[J]. Nature, 2023, 612: 45-50.');
  });

  it('超过 3 位作者只列前 3 位并加「等」', () => {
    const [line] = formatReferences(
      [{ ...base, title: '多作者研究', authors: ['张三', '李四', '王五', '赵六'], year: '2024', journal: '学刊', volume: '1' }],
      'gbt7714',
    );
    expect(line).toBe('[1] 张三, 李四, 王五, 等. 多作者研究[J]. 学刊, 2024, 1.');
  });

  it('专著、学位论文、论文集、电子资源四种类型标识与标点正确', () => {
    const lines = formatReferences(
      [
        { ...base, id: 'a', type: 'book', title: '校园工具箱设计', authors: ['张三'], year: '2023', place: '北京', publisher: '高等教育出版社' },
        { ...base, id: 'b', type: 'thesis', title: '博士论文研究', authors: ['张三'], year: '2024', place: '北京', institution: '清华大学' },
        { ...base, id: 'c', type: 'chapter', title: '工具箱章节', authors: ['张三'], year: '2024', journal: '创新教育论文集', place: '北京', publisher: '教育出版社', pages: '10-20' },
        { ...base, id: 'd', type: 'webpage', title: '教育部通知页面', authors: ['张三'], year: '2024', url: 'https://example.com/a', datePublished: '2024-05-01', dateCited: '2026-09-27' },
      ],
      'gbt7714',
    );
    expect(lines[0]).toBe('[1] 张三. 校园工具箱设计[M]. 北京: 高等教育出版社, 2023.');
    expect(lines[1]).toBe('[2] 张三. 博士论文研究[D]. 北京: 清华大学, 2024.');
    expect(lines[2]).toBe('[3] 张三. 工具箱章节[C]//创新教育论文集. 北京: 教育出版社, 2024: 10-20.');
    expect(lines[3]).toBe('[4] 张三. 教育部通知页面[EB/OL]. (2024-05-01)[2026-09-27]. https://example.com/a.');
  });

  it('顺序编码制按列表顺序自动编号', () => {
    const lines = formatReferences(
      [
        { ...base, id: 'a', title: '文献一', authors: ['张三'], year: '2024', journal: '刊一', volume: '1' },
        { ...base, id: 'b', title: '文献二', authors: ['李四'], year: '2024', journal: '刊二', volume: '2' },
      ],
      'gbt7714',
    );
    expect(lines[0].startsWith('[1]')).toBe(true);
    expect(lines[1].startsWith('[2]')).toBe(true);
  });
});

describe('reference-converter: APA 7', () => {
  it('中文作者用逗号并列，英文作者最后一位前加 &', () => {
    const lines = formatReferences(
      [
        { ...base, id: 'a', title: '人工智能研究', authors: ['张三', '李四'], year: '2024', journal: '计算机学报', volume: '47', issue: '3', pages: '101-110' },
        { ...base, id: 'b', title: 'Deep learning methods', authors: ['John K Smith', 'Meng Wang'], year: '2023', journal: 'Nature', volume: '612', pages: '45-50', doi: '10.1000/abc' },
      ],
      'apa',
    );
    expect(lines[0]).toBe('张三, 李四. (2024). 人工智能研究. 计算机学报, 47(3), 101-110.');
    expect(lines[1]).toBe('Smith, J. K., & Wang, M. (2023). Deep learning methods. Nature, 612, 45-50. https://doi.org/10.1000/abc');
  });

  it('无作者电子资源以题名开头', () => {
    const [line] = formatReferences(
      [{ ...base, id: 'a', type: 'webpage', title: '匿名网页', authors: [], year: '2024', url: 'https://x.com', siteName: '某网站' }],
      'apa',
    );
    expect(line).toBe('匿名网页. (2024). 某网站. https://x.com');
  });
});
