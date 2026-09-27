<template>
  <div style="flex: 0 0 100%">
    <div style="margin: 0 auto; max-width: 1080px">
      <c-card class="mb-3">
        <div class="mb-2 text-lg font-bold">论文参考文献格式转换</div>
        <p class="m-0 text-sm op-60">
          按字段录入文献，自动生成规范的参考文献条目，支持期刊论文、专著、学位论文、论文集、电子资源五种类型，可在
          GB/T 7714-2015（顺序编码制，自动编号）与 APA 7 两种格式间一键切换；中英文作者自动按规范处理，文献列表保存在本机，断网可用。
        </p>
      </c-card>

      <c-card class="mb-3">
        <div class="mb-3 font-bold">① 选择文献类型</div>
        <div class="mb-4 flex flex-wrap gap-2">
          <n-button
            v-for="t in types"
            :key="t.value"
            size="small"
            :type="form.type === t.value ? 'primary' : 'default'"
            @click="form.type = t.value"
          >
            {{ t.label }} [{{ t.tag }}]
          </n-button>
        </div>

        <div class="mb-3 font-bold">② 填写文献信息</div>
        <div class="ref-grid">
          <div class="ref-field ref-field-full">
            <span class="ref-label">题名</span>
            <input v-model="form.title" class="ref-input" placeholder="论文 / 著作的完整标题" data-test-id="ref-title" />
          </div>
          <div class="ref-field ref-field-full">
            <span class="ref-label">作者（每位作者一行；中文写「张三」，英文写「John K Smith」，超过 3 位会自动加「等」）</span>
            <n-input
              v-model:value="authorText"
              type="textarea"
              :autosize="{ minRows: 2, maxRows: 4 }"
              placeholder="张三（每位作者占一行）"
              data-test-id="ref-authors"
            />
          </div>
          <div class="ref-field">
            <span class="ref-label">{{ form.type === 'webpage' ? '年份（无发布日期时填写）' : '出版年份' }}</span>
            <input v-model="form.year" class="ref-input" placeholder="如 2024" />
          </div>
          <div v-for="field in currentFields" :key="field.key" class="ref-field">
            <span class="ref-label">{{ field.label }}</span>
            <input
              :value="getField(field.key)"
              :type="field.inputType || 'text'"
              class="ref-input"
              :placeholder="field.placeholder"
              @input="onFieldInput(field.key, $event)"
            />
          </div>
        </div>

        <div class="mt-3 flex items-center gap-3">
          <n-button type="primary" data-test-id="ref-add" @click="addReference">➕ 添加到文献列表</n-button>
          <n-button quaternary @click="resetForm">重置表单</n-button>
          <span v-if="formError" class="text-sm" style="color: #d03050">{{ formError }}</span>
        </div>
      </c-card>

      <c-card>
        <template #header>
          <div class="flex flex-wrap items-center justify-between gap-2">
            <span class="font-bold">③ 生成结果（已添加 {{ references.length }} 条，可 ↑↓ 调整引用顺序）</span>
            <div class="flex items-center gap-2">
              <n-button size="small" :type="style === 'gbt7714' ? 'primary' : 'default'" @click="style = 'gbt7714'">GB/T 7714-2015</n-button>
              <n-button size="small" :type="style === 'apa' ? 'primary' : 'default'" @click="style = 'apa'">APA 7</n-button>
              <n-button size="small" secondary :disabled="!references.length" @click="copyAll">复制全部</n-button>
              <n-button size="small" quaternary type="error" :disabled="!references.length" @click="references = []">清空</n-button>
            </div>
          </div>
        </template>

        <p v-if="copyHint" class="m-0 mb-2 text-sm" style="color: #18a058">{{ copyHint }}</p>

        <div v-if="!references.length" class="ref-empty">
          还没有添加文献。按上面两步填写后点「添加到文献列表」，规范格式的参考文献会出现在这里。
        </div>

        <div v-for="(line, index) in formattedLines" :key="references[index].id" class="ref-line">
          <div class="ref-line-text">{{ line }}</div>
          <div class="ref-line-actions">
            <n-button size="tiny" quaternary :disabled="index === 0" @click="move(index, -1)">↑</n-button>
            <n-button size="tiny" quaternary :disabled="index === references.length - 1" @click="move(index, 1)">↓</n-button>
            <n-button size="tiny" quaternary type="error" @click="removeReference(references[index].id)">删除</n-button>
          </div>
        </div>
      </c-card>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import {
  REFERENCE_TYPES,
  formatReferences,
  type CitationStyle,
  type Reference,
  type ReferenceType,
} from './reference-converter.service';

const REFS_STORAGE_KEY = 'campus-references-v1';
const STYLE_STORAGE_KEY = 'campus-references-style-v1';

const types = REFERENCE_TYPES;

interface FieldConfig {
  key: keyof Reference;
  label: string;
  placeholder?: string;
  inputType?: 'text' | 'url' | 'date';
}

const FIELD_MAP: Record<ReferenceType, FieldConfig[]> = {
  article: [
    { key: 'journal', label: '期刊名称', placeholder: '如 计算机学报' },
    { key: 'volume', label: '卷', placeholder: '如 47' },
    { key: 'issue', label: '期', placeholder: '如 3' },
    { key: 'pages', label: '起止页码', placeholder: '如 101-110' },
    { key: 'doi', label: 'DOI', placeholder: '如 10.1000/abc' },
  ],
  book: [
    { key: 'place', label: '出版地', placeholder: '如 北京' },
    { key: 'publisher', label: '出版社', placeholder: '如 高等教育出版社' },
    { key: 'doi', label: 'DOI / 链接（选填）', placeholder: 'https://…' },
  ],
  thesis: [
    { key: 'place', label: '保存地', placeholder: '如 北京' },
    { key: 'institution', label: '培养单位', placeholder: '如 清华大学' },
    { key: 'thesisLevel', label: '学位层次（选填）', placeholder: '硕士 / 博士' },
    { key: 'url', label: '网址（选填）', inputType: 'url', placeholder: 'https://…' },
  ],
  chapter: [
    { key: 'journal', label: '论文集名称', placeholder: '如 创新教育论文集' },
    { key: 'place', label: '出版地', placeholder: '如 北京' },
    { key: 'publisher', label: '出版者', placeholder: '如 教育出版社' },
    { key: 'pages', label: '起止页码', placeholder: '如 10-20' },
  ],
  webpage: [
    { key: 'siteName', label: '网站 / 平台名称', placeholder: '如 中国政府网' },
    { key: 'url', label: '网址', inputType: 'url', placeholder: 'https://…' },
    { key: 'datePublished', label: '发布日期', inputType: 'date' },
    { key: 'dateCited', label: '引用日期', inputType: 'date' },
  ],
};

const emptyForm = (): Reference => ({
  id: '',
  type: 'article',
  title: '',
  authors: [],
  year: '',
  journal: '',
  volume: '',
  issue: '',
  pages: '',
  place: '',
  publisher: '',
  institution: '',
  siteName: '',
  url: '',
  datePublished: '',
  dateCited: '',
  doi: '',
  thesisLevel: '',
});

const form = ref<Reference>(emptyForm());
const authorText = ref('');
const formError = ref('');
const references = ref<Reference[]>([]);
const style = ref<CitationStyle>('gbt7714');
const copyHint = ref('');

onMounted(() => {
  try {
    const refsRaw = localStorage.getItem(REFS_STORAGE_KEY);
    if (refsRaw) {
      references.value = JSON.parse(refsRaw);
    }
    const styleRaw = localStorage.getItem(STYLE_STORAGE_KEY);
    if (styleRaw === 'apa' || styleRaw === 'gbt7714') {
      style.value = styleRaw;
    }
  } catch {
    // 本地数据损坏时保持空列表
  }
});

watch(references, value => localStorage.setItem(REFS_STORAGE_KEY, JSON.stringify(value)), { deep: true });
watch(style, value => localStorage.setItem(STYLE_STORAGE_KEY, value));

const currentFields = computed(() => FIELD_MAP[form.value.type]);
const formattedLines = computed(() => formatReferences(references.value, style.value));

const getField = (key: keyof Reference): string => {
  const value = form.value[key];
  return typeof value === 'string' ? value : '';
};

const setField = (key: keyof Reference, value: string) => {
  (form.value as Record<string, string>)[key] = value;
};

const onFieldInput = (key: keyof Reference, event: Event) => {
  setField(key, (event.target as HTMLInputElement).value);
};

const addReference = () => {
  formError.value = '';
  if (!form.value.title.trim()) {
    formError.value = '请至少填写题名。';
    return;
  }
  const authors = authorText.value
    .split('\n')
    .map(name => name.trim())
    .filter(Boolean);
  references.value.push({
    ...form.value,
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
    title: form.value.title.trim(),
    authors,
  });
  resetForm();
};

const resetForm = () => {
  const type = form.value.type;
  form.value = emptyForm();
  form.value.type = type;
  authorText.value = '';
  formError.value = '';
};

const removeReference = (id: string) => {
  references.value = references.value.filter(ref => ref.id !== id);
};

const move = (index: number, delta: number) => {
  const target = index + delta;
  if (target < 0 || target >= references.value.length) {
    return;
  }
  const list = [...references.value];
  const [item] = list.splice(index, 1);
  list.splice(target, 0, item);
  references.value = list;
};

const copyAll = async () => {
  const text = formattedLines.value.join('\n');
  try {
    await navigator.clipboard.writeText(text);
    copyHint.value = '已复制全部参考文献，可直接粘贴到论文中。';
  } catch {
    copyHint.value = '浏览器阻止了自动复制，请手动选中结果文本复制。';
  }
  setTimeout(() => {
    copyHint.value = '';
  }, 3000);
};
</script>

<style lang="less" scoped>
.ref-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px 16px;
}

@media (max-width: 700px) {
  .ref-grid {
    grid-template-columns: 1fr;
  }
}

.ref-field-full {
  grid-column: 1 / -1;
}

.ref-label {
  display: block;
  margin-bottom: 4px;
  font-size: 12px;
  color: #666;
}

.ref-input {
  width: 100%;
  padding: 6px 10px;
  font-size: 14px;
  border: 1px solid var(--n-border-color, #d9d9d9);
  border-radius: 6px;
  background: var(--n-color, #fff);
}

.ref-empty {
  padding: 16px;
  font-size: 14px;
  color: #999;
  background: #fafafa;
  border-radius: 6px;
}

.ref-line {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 8px 10px;
  margin-bottom: 6px;
  background: #fafafa;
  border: 1px solid #eee;
  border-radius: 6px;
}

.ref-line-text {
  flex: 1;
  font-size: 13px;
  line-height: 1.7;
  word-break: break-all;
}

.ref-line-actions {
  flex: none;
  display: flex;
  gap: 2px;
}
</style>
