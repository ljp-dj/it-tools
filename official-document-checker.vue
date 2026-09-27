<template>
  <div style="flex: 0 0 100%">
    <div style="margin: 0 auto; max-width: 1100px">
      <c-card class="mb-3">
        <div class="mb-2 text-lg font-bold">公文格式自检</div>
        <p class="m-0 text-sm op-60">
          粘贴通知、请示、报告等公文全文，工具会依据通用公文格式规范（参照 GB/T 9704-2012）自动检查标题文种、主送机关、层次序号、标点、用词与成文日期，并逐条给出修改建议。全文只在你的浏览器本地分析，不上传、不外泄，断网可用。
        </p>
      </c-card>

      <div class="doc-grid">
        <c-card>
          <template #header>
            <div class="flex items-center justify-between">
              <span class="font-bold">公文原文</span>
              <div class="flex gap-2">
                <n-button size="small" secondary @click="loadExample">填入示例</n-button>
                <n-button size="small" quaternary @click="text = ''">清空</n-button>
              </div>
            </div>
          </template>
          <n-input
            v-model:value="text"
            type="textarea"
            :autosize="{ minRows: 20, maxRows: 32 }"
            placeholder="在此粘贴完整公文，例如：&#10;关于开展2026年秋季社团招新工作的通知&#10;各学生社团：&#10;　　正文……&#10;学生社团联合会&#10;2026年9月27日"
            data-test-id="doc-input"
          />
        </c-card>

        <c-card>
          <template #header>
            <span class="font-bold">自检结果（实时更新）</span>
          </template>

          <div class="doc-summary">
            <span class="doc-badge doc-badge-error">必须修改 {{ errorCount }}</span>
            <span class="doc-badge doc-badge-warning">建议修改 {{ warningCount }}</span>
            <span class="doc-badge doc-badge-info">供参考 {{ infoCount }}</span>
          </div>

          <div v-if="!text.trim()" class="doc-empty">粘贴公文后，这里会实时列出所有格式问题。</div>
          <div v-else-if="errorCount === 0 && warningCount === 0 && infoCount === 0" class="doc-all-pass">
            未发现格式问题，文本符合当前内置的全部自检规则。
          </div>
          <div v-else-if="errorCount === 0" class="doc-pass">
            没有必须修改的硬性错误，下面还有 {{ warningCount + infoCount }} 条建议可进一步完善。
          </div>

          <div v-for="(issue, index) in issues" :key="index" class="doc-issue" :class="`doc-issue-${issue.severity}`">
            <div class="mb-1 flex items-center gap-2">
              <span class="doc-severity" :class="`doc-severity-${issue.severity}`">{{ severityMeta[issue.severity].label }}</span>
              <span class="doc-category">{{ issue.category }}</span>
            </div>
            <div class="doc-message">{{ issue.message }}</div>
            <div class="doc-suggestion">{{ issue.suggestion }}</div>
            <div v-if="issue.excerpt" class="doc-excerpt">原文片段：{{ issue.excerpt }}</div>
          </div>
        </c-card>
      </div>

      <c-card class="mt-3">
        <template #header>
          <span class="font-bold">排版规格速查（以下项目网页无法自动识别，需在 Word / WPS 中人工确认）</span>
        </template>
        <div class="doc-rules">
          <div v-for="rule in formattingRules" :key="rule.item" class="doc-rule">
            <div class="doc-rule-item">{{ rule.item }}</div>
            <div class="op-70">{{ rule.detail }}</div>
          </div>
        </div>
      </c-card>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import {
  EXAMPLE_DOCUMENT,
  FORMATTING_RULES,
  checkDocument,
  type DocumentIssue,
  type IssueSeverity,
} from './official-document-checker.service';

const STORAGE_KEY = 'campus-official-document-checker-v1';

const text = ref('');
const formattingRules = FORMATTING_RULES;

const severityMeta: Record<IssueSeverity, { label: string }> = {
  error: { label: '必须修改' },
  warning: { label: '建议修改' },
  info: { label: '供参考' },
};

onMounted(() => {
  text.value = localStorage.getItem(STORAGE_KEY) ?? '';
});

watch(text, value => localStorage.setItem(STORAGE_KEY, value));

const issues = computed<DocumentIssue[]>(() => checkDocument(text.value));
const errorCount = computed(() => issues.value.filter(issue => issue.severity === 'error').length);
const warningCount = computed(() => issues.value.filter(issue => issue.severity === 'warning').length);
const infoCount = computed(() => issues.value.filter(issue => issue.severity === 'info').length);

const loadExample = () => {
  text.value = EXAMPLE_DOCUMENT;
};
</script>

<style lang="less" scoped>
.doc-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  align-items: start;
}

@media (max-width: 900px) {
  .doc-grid {
    grid-template-columns: 1fr;
  }
}

.doc-summary {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 12px;
}

.doc-badge {
  padding: 3px 10px;
  font-size: 12px;
  border-radius: 12px;
}

.doc-badge-error {
  color: #d03050;
  background: #ffecec;
}

.doc-badge-warning {
  color: #b8740a;
  background: #fff7e0;
}

.doc-badge-info {
  color: #2080a0;
  background: #e8f7fc;
}

.doc-empty,
.doc-all-pass,
.doc-pass {
  padding: 12px;
  margin-bottom: 10px;
  font-size: 14px;
  border-radius: 6px;
}

.doc-empty {
  color: #999;
  background: #fafafa;
}

.doc-all-pass {
  color: #157a3d;
  background: #e9f9ef;
  border: 1px solid #a6e2c0;
}

.doc-pass {
  color: #157a3d;
  background: #f3fbf6;
  border: 1px solid #d3eee0;
}

.doc-issue {
  padding: 10px 12px;
  margin-bottom: 8px;
  background: #fafafa;
  border: 1px solid #eee;
  border-left-width: 4px;
  border-radius: 6px;
}

.doc-issue-error {
  border-left-color: #d03050;
}

.doc-issue-warning {
  border-left-color: #f0a020;
}

.doc-issue-info {
  border-left-color: #2080a0;
}

.doc-severity {
  padding: 1px 8px;
  font-size: 11px;
  color: #fff;
  border-radius: 4px;
}

.doc-severity-error {
  background: #d03050;
}

.doc-severity-warning {
  background: #f0a020;
}

.doc-severity-info {
  background: #2080a0;
}

.doc-category {
  font-size: 12px;
  font-weight: 600;
  color: #666;
}

.doc-message {
  margin-bottom: 4px;
  font-size: 14px;
  font-weight: 500;
}

.doc-suggestion {
  font-size: 13px;
  color: #555;
  line-height: 1.6;
}

.doc-excerpt {
  padding: 4px 8px;
  margin-top: 6px;
  font-size: 12px;
  color: #888;
  background: #fff;
  border-left: 2px solid #ddd;
}

.doc-rules {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px 20px;
}

@media (max-width: 700px) {
  .doc-rules {
    grid-template-columns: 1fr;
  }
}

.doc-rule {
  padding: 8px 10px;
  font-size: 13px;
  background: #fafafa;
  border-radius: 6px;
}

.doc-rule-item {
  margin-bottom: 2px;
  font-weight: 600;
}
</style>
