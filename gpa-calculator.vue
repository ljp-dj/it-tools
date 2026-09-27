<template>
  <div style="flex: 0 0 100%">
    <div style="margin: 0 auto; max-width: 720px">
      <c-card mb-3>
        <div mb-3 flex items-center gap-3 flex-wrap>
          <span whitespace-nowrap>绩点算法</span>
          <select v-model="mode" class="gpa-select" data-test-id="gpa-mode">
            <option value="4point">标准 4.0 制（分段换算）</option>
            <option value="45point">4.5 制（百分制线性换算）</option>
            <option value="5point">5 分制（百分制线性换算）</option>
            <option value="weightedAvg">只看加权平均分</option>
          </select>
        </div>
        <p text-sm op-60 m-0>
          所有计算均在你的浏览器本地完成，成绩不会上传到任何服务器，断网也能使用。
        </p>
      </c-card>

      <c-card v-for="(course, index) in courseList" :key="index" mb-3>
        <div flex items-center gap-2 flex-wrap>
          <span w-8 text-center op-60>{{ index + 1 }}</span>
          <input
            v-model.number="course.score"
            type="number"
            min="0"
            max="100"
            placeholder="百分制成绩，如 88"
            class="gpa-input"
            data-test-id="course-score"
          />
          <input
            v-model.number="course.credit"
            type="number"
            min="0"
            step="0.5"
            placeholder="学分，如 4"
            class="gpa-input"
            style="max-width: 140px"
            data-test-id="course-credit"
          />
          <n-button size="small" type="error" ghost :disabled="courseList.length <= 1" @click="removeCourse(index)">
            删除
          </n-button>
        </div>
      </c-card>

      <div mb-3>
        <n-button type="primary" data-test-id="add-course" @click="addCourse">
          ➕ 添加一门课
        </n-button>
      </div>

      <c-card v-if="totalCredit > 0">
        <div flex justify-around flex-wrap gap-3>
          <div text-center>
            <div op-60 text-sm>总学分</div>
            <div text-2xl font-bold data-test-id="total-credit">{{ totalCredit.toFixed(1) }}</div>
          </div>
          <div text-center>
            <div op-60 text-sm>加权平均分</div>
            <div text-2xl font-bold data-test-id="weighted-average">{{ weightedAverage.toFixed(2) }}</div>
          </div>
          <div v-if="mode !== 'weightedAvg'" text-center>
            <div op-60 text-sm>对应绩点</div>
            <div text-2xl font-bold data-test-id="gpa-result">{{ gpaResult.toFixed(2) }}</div>
          </div>
        </div>
      </c-card>
      <c-card v-else>
        <p m-0 op-60>请至少完整填写一门课的成绩和学分。</p>
      </c-card>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';

type CourseItem = {
  score: number | null;
  credit: number | null;
};

type GpaMode = '4point' | '45point' | '5point' | 'weightedAvg';

const mode = ref<GpaMode>('4point');
const courseList = ref<CourseItem[]>([{ score: null, credit: null }]);

const addCourse = () => {
  courseList.value.push({ score: null, credit: null });
};

const removeCourse = (index: number) => {
  if (courseList.value.length > 1) {
    courseList.value.splice(index, 1);
  }
};

const validCourses = computed(() =>
  courseList.value.filter(
    course =>
      course.score !== null &&
      course.credit !== null &&
      !Number.isNaN(course.score) &&
      !Number.isNaN(course.credit) &&
      course.credit > 0,
  ),
);

const totalCredit = computed(() => validCourses.value.reduce((sum, course) => sum + Number(course.credit), 0));

const weightedAverage = computed(() => {
  if (totalCredit.value <= 0) {
    return 0;
  }
  const weightedSum = validCourses.value.reduce(
    (sum, course) => sum + Number(course.score) * Number(course.credit),
    0,
  );
  return weightedSum / totalCredit.value;
});

const gpaResult = computed(() => {
  const average = weightedAverage.value;
  if (mode.value === '4point') {
    if (average >= 90) return 4.0;
    if (average >= 85) return 3.7;
    if (average >= 82) return 3.3;
    if (average >= 78) return 3.0;
    if (average >= 75) return 2.7;
    if (average >= 72) return 2.3;
    if (average >= 68) return 2.0;
    if (average >= 64) return 1.5;
    if (average >= 60) return 1.0;
    return 0;
  }
  if (mode.value === '45point') {
    return (average / 100) * 4.5;
  }
  if (mode.value === '5point') {
    return (average / 100) * 5;
  }
  return 0;
});
</script>

<style lang="less" scoped>
.gpa-select {
  flex: 1;
  min-width: 240px;
  padding: 8px 12px;
  border: 1px solid var(--n-border-color, #d9d9d9);
  border-radius: 6px;
  background: var(--n-color, #fff);
  font-size: 14px;
}

.gpa-input {
  flex: 1;
  min-width: 160px;
  padding: 8px 12px;
  border: 1px solid var(--n-border-color, #d9d9d9);
  border-radius: 6px;
  font-size: 14px;
}
</style>
