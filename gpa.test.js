/**
 * GPA 核心逻辑单元测试（Node 内置 test runner，零依赖）
 * 运行：node --test  或  npm test
 */
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');

const { parseScore, scoreToPoint4, scoreToPoint5, scoreToPoint, computeStats, round2 } = require('../js/gpa.js');

test('parseScore：解析百分制数字', () => {
  assert.equal(parseScore('92'), 92);
  assert.equal(parseScore('88.5'), 88.5);
  assert.equal(parseScore(' 60 '), 60);
  assert.equal(parseScore('0'), 0);
});

test('parseScore：兼容「分」后缀', () => {
  assert.equal(parseScore('92分'), 92);
  assert.equal(parseScore('100分'), 100);
});

test('parseScore：解析等级制成绩', () => {
  assert.equal(parseScore('优秀'), 95);
  assert.equal(parseScore('良好'), 85);
  assert.equal(parseScore('中等'), 75);
  assert.equal(parseScore('及格'), 65);
  assert.equal(parseScore('不及格'), 0);
});

test('parseScore：拒绝非法输入', () => {
  assert.equal(parseScore('abc'), null);
  assert.equal(parseScore('120'), null);
  assert.equal(parseScore('-5'), null);
  assert.equal(parseScore(''), null);
  assert.equal(parseScore('优秀优秀'), null);
});

test('scoreToPoint4：分档边界', () => {
  assert.equal(scoreToPoint4(100), 4.0);
  assert.equal(scoreToPoint4(90), 4.0);
  assert.equal(scoreToPoint4(89.9), 3.7);
  assert.equal(scoreToPoint4(85), 3.7);
  assert.equal(scoreToPoint4(60), 1.0);
  assert.equal(scoreToPoint4(59.9), 0);
  assert.equal(scoreToPoint4(0), 0);
});

test('scoreToPoint5：连续制', () => {
  assert.equal(scoreToPoint5(100), 5);
  assert.equal(scoreToPoint5(90), 4);
  assert.equal(scoreToPoint5(75), 2.5);
  assert.equal(scoreToPoint5(60), 1);
  assert.equal(scoreToPoint5(59), 0);
});

test('scoreToPoint：未知算法回退到 4.0', () => {
  assert.equal(scoreToPoint(90, '4.0'), 4);
  assert.equal(scoreToPoint(90, '5.0'), 4);
  assert.equal(scoreToPoint(90, '随便写的'), 4);
});

test('computeStats：4.0 加权平均与 GPA', () => {
  const courses = [
    { credits: 3, score: 90 },
    { credits: 2, score: 80 },
    { credits: 4, score: 70 },
  ];
  const s = computeStats(courses, '4.0');
  assert.equal(s.courseCount, 3);
  assert.equal(s.totalCredits, 9);
  // 加权平均分 = (3*90 + 2*80 + 4*70) / 9 = 710/9 ≈ 78.89
  assert.equal(s.weightedAverage, 78.89);
  // GPA = (3*4.0 + 2*3.0 + 4*2.0) / 9 = 26/9 ≈ 2.89
  assert.equal(s.gpa, 2.89);
});

test('computeStats：5.0 连续制', () => {
  const courses = [
    { credits: 2, score: 95 },
    { credits: 2, score: 60 },
    { credits: 1, score: 50 },
  ];
  const s = computeStats(courses, '5.0');
  assert.equal(s.totalCredits, 5);
  // 加权平均分 = (2*95 + 2*60 + 1*50) / 5 = 72
  assert.equal(s.weightedAverage, 72);
  // GPA = (2*4.5 + 2*1.0 + 1*0) / 5 = 2.2
  assert.equal(s.gpa, 2.2);
});

test('computeStats：空列表返回 null', () => {
  const s = computeStats([], '4.0');
  assert.equal(s.courseCount, 0);
  assert.equal(s.totalCredits, 0);
  assert.equal(s.weightedAverage, null);
  assert.equal(s.gpa, null);
});

test('round2：浮点边界四舍五入（2.005 应进位为 2.01）', () => {
  assert.equal(round2(2.005), 2.01);
  assert.equal(round2(3.375), 3.38);
  assert.equal(round2(1.005), 1.01);
});

test('computeStats：过滤无效课程（脏数据）', () => {
  const courses = [
    { credits: 0, score: 90 },   // 学分为 0
    { credits: NaN, score: 80 }, // 学分非法
    null,                        // 脏数据
    { credits: 3, score: 85 },
  ];
  const s = computeStats(courses, '4.0');
  assert.equal(s.courseCount, 1);
  assert.equal(s.totalCredits, 3);
  assert.equal(s.weightedAverage, 85);
  assert.equal(s.gpa, 3.7);
});
