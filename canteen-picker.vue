<template>
  <div style="flex: 0 0 100%">
    <div style="margin: 0 auto; max-width: 960px">
      <c-card class="mb-3">
        <div class="mb-2 text-lg font-bold">今天吃什么 · 食堂菜品随机选</div>
        <p class="m-0 text-sm op-60">
          把学校食堂和你在每个食堂爱吃的菜录进来，选择困难时点一下，由它替你决定。可以只随机食堂，也可以从全部菜品中随机抽一道，并显示菜品来自哪个食堂。数据保存在本机，断网可用。
        </p>
      </c-card>

      <div class="cp-layout">
        <c-card>
          <!-- 移除 #header 插槽，按钮直接放卡片内容最顶部 -->
          <div class="flex items-center justify-between mb-3">
            <span class="font-bold">我的食堂（菜品每行一个，也可用逗号分隔）</span>
            <n-button size="small" type="primary" ghost @click="addCanteen">＋ 添加食堂</n-button>
          </div>

          <div v-for="canteen in canteens" :key="canteen.id" class="cp-canteen">
            <div class="mb-1 flex items-center gap-2">
              <input v-model="canteen.name" class="cp-name" placeholder="食堂名称，如 一食堂" data-test-id="canteen-name" />
              <n-button size="tiny" quaternary type="error" @click="removeCanteen(canteen.id)">删除食堂</n-button>
            </div>
            <n-input
              v-model:value="canteen.dishText"
              type="textarea"
              :autosize="{ minRows: 2, maxRows: 6 }"
              placeholder="红烧肉&#10;番茄炒蛋&#10;黄焖鸡米饭"
              data-test-id="canteen-dishes"
            />
            <div class="mt-1 text-xs op-50">已录入 {{ dishCount(canteen.dishText) }} 道菜</div>
          </div>

          <div v-if="!canteens.length" class="cp-empty">还没有食堂，点右上角「添加食堂」开始吧。</div>
        </c-card>

        <c-card>
          <div class="font-bold mb-3">开始抽签</div>

          <div class="flex flex-col gap-3">
            <n-button type="primary" size="large" :disabled="rolling || !canteenOptions.length" data-test-id="pick-canteen" @click="rollCanteen">
              🎲 随机选一个食堂
            </n-button>
            <n-button size="large" :disabled="rolling || !dishOptions.length" data-test-id="pick-dish" @click="rollDish">
              🍜 随机抽一道菜
            </n-button>
            <n-button quaternary size="small" :disabled="rolling" @click="resetResult">清空结果</n-button>
          </div>

          <p v-if="hint" class="m-0 mt-3 text-sm" style="color: #d03050">{{ hint }}</p>

          <div class="cp-result">
            <template v-if="resultMode === 'canteen'">
              <div class="cp-result-label">今天去这里吃</div>
              <div class="cp-result-main" data-test-id="result-canteen">{{ resultMain }}</div>
            </template>
            <template v-else-if="resultMode === 'dish'">
              <div class="cp-result-label">今天吃这道</div>
              <div class="cp-result-main" data-test-id="result-dish">{{ resultMain }}</div>
              <div v-if="resultSub" class="cp-result-sub">📍 {{ resultSub }}</div>
            </template>
            <template v-else>
              <div class="cp-result-placeholder">结果会显示在这里</div>
            </template>
          </div>
        </c-card>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { collectDishes, parseDishes, pickRandom, validCanteens, type CanteenData, type DishChoice } from './canteen-picker.service';

interface CanteenDraft {
  id: string;
  name: string;
  dishText: string;
}

const STORAGE_KEY = 'campus-canteen-picker-v1';
const ROLL_TICKS = 16;
const ROLL_INTERVAL_MS = 70;

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

const defaultCanteens = (): CanteenDraft[] => [
  { id: uid(), name: '一食堂', dishText: '红烧肉\n番茄炒蛋\n黄焖鸡米饭' },
  { id: uid(), name: '二食堂', dishText: '麻辣香锅\n兰州拉面\n水饺' },
];

const canteens = ref<CanteenDraft[]>(defaultCanteens());
const rolling = ref(false);
const hint = ref('');
const resultMode = ref<'' | 'canteen' | 'dish'>('');
const resultMain = ref('');
const resultSub = ref('');

let timer: ReturnType<typeof setInterval> | null = null;

onMounted(() => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as CanteenDraft[];
      if (Array.isArray(parsed)) {
        canteens.value = parsed;
      }
    }
  } catch {
  }
});

watch(canteens, value => localStorage.setItem(STORAGE_KEY, JSON.stringify(value)), { deep: true });

onUnmounted(() => {
  if (timer) clearInterval(timer);
});

const dishCount = (text: string) => parseDishes(text).length;

const normalizedCanteens = computed<CanteenData[]>(() =>
  validCanteens(
    canteens.value.map(c => ({
      id: c.id,
      name: c.name.trim(),
      dishes: parseDishes(c.dishText),
    }))
  )
);

const canteenOptions = computed(() => normalizedCanteens.value.map(c => c.name));
const dishOptions = computed<DishChoice[]>(() => collectDishes(normalizedCanteens.value));

const addCanteen = () => {
  canteens.value.push({ id: uid(), name: '', dishText: '' });
};

const removeCanteen = (id: string) => {
  canteens.value = canteens.value.filter(c => c.id !== id);
};

const resetResult = () => {
  resultMode.value = '';
  resultMain.value = '';
  resultSub.value = '';
  hint.value = '';
};

const animateRoll = (candidates: string[], onFinish: () => void) => {
  if (rolling.value || candidates.length === 0) return;
  rolling.value = true;
  hint.value = '';
  let ticks = 0;
  timer = setInterval(() => {
    resultMain.value = candidates[Math.floor(Math.random() * candidates.length)];
    ticks += 1;
    if (ticks >= ROLL_TICKS) {
      clearInterval(timer!);
      rolling.value = false;
      onFinish();
    }
  }, ROLL_INTERVAL_MS);
};

const rollCanteen = () => {
  const opts = canteenOptions.value;
  if (!opts.length) {
    hint.value = '请先添加至少一个食堂并填写食堂名称';
    return;
  }
  resultMode.value = 'canteen';
  resultSub.value = '';
  animateRoll(opts, () => {
    const picked = pickRandom(opts);
    resultMain.value = picked ?? '';
  });
};

const rollDish = () => {
  const opts = dishOptions.value;
  if (!opts.length) {
    hint.value = '请录入至少一道菜品';
    return;
  }
  resultMode.value = 'dish';
  const dishLabels = opts.map(d => d.dish);
  animateRoll(dishLabels, () => {
    const picked = pickRandom(opts);
    if (picked) {
      resultMain.value = picked.dish;
      resultSub.value = `${picked.canteenName}`;
    }
  });
};
</script>

<style lang="less" scoped>
.cp-layout {
  display: grid;
  grid-template-columns: 1.4fr 1fr;
  gap: 12px;
  align-items: start;
}

@media (max-width: 860px) {
  .cp-layout {
    grid-template-columns: 1fr;
  }
}

.cp-canteen {
  padding: 10px;
  margin-bottom: 12px;
  background: #fafafa;
  border: 1px solid #eee;
  border-radius: 8px;
}

.cp-name {
  flex: 1;
  padding: 6px 10px;
  font-size: 14px;
  font-weight: 600;
  border: 1px solid var(--n-border-color, #d9d9d9);
  border-radius: 6px;
  background: var(--n-color, #fff);
}

.cp-empty {
  padding: 16px;
  font-size: 14px;
  color: #999;
  text-align: center;
  background: #f7f7f7;
  border-radius: 6px;
}

.cp-result {
  margin-top: 24px;
  padding: 20px 12px;
  text-align: center;
}
.cp-result-label {
  font-size: 14px;
  color: #666;
  margin-bottom: 8px;
}
.cp-result-main {
  font-size: 28px;
  font-weight: bold;
  color: #124;
}
.cp-result-sub {
  margin-top:10px;
  font-size:15px;
  color:#237842;
}
.cp-result-placeholder {
  color:#aaa;
  padding-top:12px;
}
</style>
