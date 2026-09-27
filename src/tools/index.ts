import { FileText } from '@vicons/tabler';
import { defineTool } from '../tool';

export const tool = defineTool({
  name: '参考文献格式转换',
  path: '/reference-converter',
  description: '按字段录入期刊论文、专著、学位论文、论文集、电子资源等文献，一键生成 GB/T 7714-2015 或 APA 7 规范参考文献，中英文作者姓名自动处理、顺序编码自动编号、批量复制，全部本地生成、离线可用。',
  keywords: ['reference', '参考文献', '引用', 'GB/T 7714', 'APA', '论文', '格式转换', 'citation', 'bibtex'],
  component: () => import('./reference-converter.vue'),
  icon: FileText,
  createdAt: new Date('2026-09-27'),
});
