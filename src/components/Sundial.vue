<template>
  <div class="sundial-container">
    <svg 
      ref="svgElement"
      class="sundial" 
      viewBox="0 0 200 200"
      @mousemove="handleMouseMove"
      @mouseup="handleMouseUp"
      @mouseleave="handleMouseUp"
      @touchmove="handleTouchMove"
      @touchend="handleTouchEnd"
    >
      <!-- Outer circle -->
      <circle cx="100" cy="100" r="95" fill="none" stroke="currentColor" stroke-width="2" opacity="0.3"/>

      <!-- Event markers -->
      <g v-if="events.length > 0">
        <line
          v-for="event in events"
          :key="event.name"
          :x1="100 + 95 * Math.cos(event.angle)"
          :y1="100 + 95 * Math.sin(event.angle)"
          :x2="100 + 85 * Math.cos(event.angle)"
          :y2="100 + 85 * Math.sin(event.angle)"
          stroke="currentColor"
          :stroke-width="event.isMajor ? 2 : 1"
          :opacity="event.isMajor ? 0.6 : 0.3"
        />
        <text
          v-for="event in events.filter(e => e.isMajor)"
          :key="`label-${event.name}`"
          :x="100 + 75 * Math.cos(event.angle)"
          :y="100 + 75 * Math.sin(event.angle)"
          text-anchor="middle"
          dominant-baseline="middle"
          font-size="8"
          fill="currentColor"
          opacity="0.7"
        >
          {{ event.label }}
        </text>
      </g>

      <!-- Progress arc (from midnight to current time) -->
      <path
        v-if="progressAngle !== null"
        :d="progressArc"
        fill="none"
        stroke="currentColor"
        stroke-width="3"
        opacity="0.8"
        stroke-linecap="round"
      />

      <!-- Current sun position indicator (draggable) -->
      <circle
        v-if="progressAngle !== null"
        :cx="100 + 90 * Math.cos(progressAngle)"
        :cy="100 + 90 * Math.sin(progressAngle)"
        :r="isHovering || isDragging ? 8 : 4"
        fill="currentColor"
        class="draggable-handle"
        :class="{ 'dragging': isDragging }"
        @mousedown="handleMouseDown"
        @mouseenter="isHovering = true"
        @mouseleave="handleMouseLeave"
        @touchstart="handleTouchStart"
      />

      <!-- Center dot (clickable when in override mode) -->
      <circle 
        cx="100" 
        cy="100" 
        :r="isOverride ? (isCenterHovering ? 7 : 5) : 3" 
        fill="currentColor" 
        :opacity="isOverride ? (isCenterHovering ? 1 : 0.8) : 0.5"
        :class="{ 'center-dot-override': isOverride, 'center-dot': !isOverride }"
        @click="handleCenterClick"
        @mouseenter="handleCenterEnter"
        @mouseleave="handleCenterLeave"
      />
      
      <!-- Subtle reset icon when in override mode -->
      <g 
        v-if="isOverride" 
        class="reset-icon" 
        @click="handleReset"
        @mouseenter="handleCenterEnter"
        @mouseleave="handleCenterLeave"
      >
        <circle 
          cx="100" 
          cy="100" 
          r="10" 
          fill="none" 
          stroke="currentColor" 
          stroke-width="1" 
          :opacity="isCenterHovering ? 0.5 : 0.2"
          class="reset-icon-circle"
        />
        <path 
          d="M 95 100 L 100 95 M 100 95 L 105 100 M 105 100 L 100 105 M 100 105 L 95 100" 
          stroke="currentColor" 
          stroke-width="1.5" 
          stroke-linecap="round"
          :opacity="isCenterHovering ? 0.9 : 0.5"
          fill="none"
          class="reset-icon-path"
        />
      </g>
      
      <!-- Reset text when in override mode -->
      <text
        v-if="isOverride"
        x="100"
        y="115"
        text-anchor="middle"
        dominant-baseline="middle"
        font-size="7"
        fill="currentColor"
        :opacity="isCenterHovering ? 0.8 : 0.5"
        class="reset-text"
        @click="handleReset"
        @mouseenter="handleCenterEnter"
        @mouseleave="handleCenterLeave"
      >
        Reset
      </text>
    </svg>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import type { SundialEvent } from '../composables/useSunCalculations';
import { angleToMinutes } from '../composables/useSunCalculations';

interface Props {
  events: SundialEvent[];
  progressAngle: number | null;
  modelValue: number; // current minutes
  isOverride: boolean; // whether time is manually overridden
}

const props = defineProps<Props>();
const emit = defineEmits<{
  'update:modelValue': [minutes: number];
  'dragging': [isDragging: boolean];
  'reset': [];
}>();

const svgElement = ref<SVGSVGElement | null>(null);
const isDragging = ref(false);
const isHovering = ref(false);
const isCenterHovering = ref(false);

const progressArc = computed(() => {
  if (props.progressAngle === null) return '';
  
  const radius = 90;
  const centerX = 100;
  const centerY = 100;
  const startAngle = -Math.PI / 2;
  
  const startX = centerX + radius * Math.cos(startAngle);
  const startY = centerY + radius * Math.sin(startAngle);
  const endX = centerX + radius * Math.cos(props.progressAngle);
  const endY = centerY + radius * Math.sin(props.progressAngle);
  
  const angleDiff = props.progressAngle - startAngle;
  const largeArc = Math.abs(angleDiff) > Math.PI ? 1 : 0;
  
  return `M ${startX} ${startY} A ${radius} ${radius} 0 ${largeArc} 1 ${endX} ${endY}`;
});

// Get mouse/touch position relative to SVG
function getSVGPoint(clientX: number, clientY: number): { x: number; y: number } | null {
  if (!svgElement.value) return null;
  
  const svg = svgElement.value;
  const point = svg.createSVGPoint();
  point.x = clientX;
  point.y = clientY;
  
  const svgPoint = point.matrixTransform(svg.getScreenCTM()?.inverse());
  return { x: svgPoint.x, y: svgPoint.y };
}

// Calculate angle from center to point
function calculateAngle(x: number, y: number): number {
  const centerX = 100;
  const centerY = 100;
  const dx = x - centerX;
  const dy = y - centerY;
  return Math.atan2(dy, dx);
}

// Update time based on mouse/touch position
function updateTimeFromPosition(clientX: number, clientY: number) {
  const point = getSVGPoint(clientX, clientY);
  if (!point) return;
  
  const angle = calculateAngle(point.x, point.y);
  const minutes = angleToMinutes(angle);
  emit('update:modelValue', minutes);
}

// Mouse handlers
function handleMouseDown(event: MouseEvent) {
  event.preventDefault();
  isDragging.value = true;
  emit('dragging', true);
  updateTimeFromPosition(event.clientX, event.clientY);
}

function handleMouseMove(event: MouseEvent) {
  if (!isDragging.value) return;
  updateTimeFromPosition(event.clientX, event.clientY);
}

function handleMouseLeave() {
  if (!isDragging.value) {
    isHovering.value = false;
  }
}

function handleMouseUp() {
  isDragging.value = false;
  isHovering.value = false;
  emit('dragging', false);
}

// Touch handlers
function handleTouchStart(event: TouchEvent) {
  event.preventDefault();
  isDragging.value = true;
  emit('dragging', true);
  const touch = event.touches[0];
  if (touch) {
    updateTimeFromPosition(touch.clientX, touch.clientY);
  }
}

function handleTouchMove(event: TouchEvent) {
  if (!isDragging.value) return;
  event.preventDefault();
  const touch = event.touches[0];
  if (touch) {
    updateTimeFromPosition(touch.clientX, touch.clientY);
  }
}

function handleTouchEnd() {
  isDragging.value = false;
  isHovering.value = false;
  emit('dragging', false);
}

// Handle reset button click
function handleReset() {
  emit('reset');
}

// Handle center dot interactions
function handleCenterClick() {
  if (props.isOverride) {
    handleReset();
  }
}

function handleCenterEnter() {
  if (props.isOverride) {
    isCenterHovering.value = true;
  }
}

function handleCenterLeave() {
  isCenterHovering.value = false;
}
</script>

<style scoped>
.sundial-container {
  margin-top: 2rem;
  position: relative;
  display: inline-block;
}

.sundial {
  width: 300px;
  height: 300px;
  max-width: 90vw;
  max-height: 90vw;
  user-select: none;
  -webkit-user-select: none;
}

.draggable-handle {
  cursor: grab;
  transition: r 0.2s ease;
}

.draggable-handle:hover {
  cursor: grab;
}

.dragging {
  cursor: grabbing !important;
}

.center-dot {
  transition: r 0.2s ease, opacity 0.2s ease;
}

.center-dot-override {
  cursor: pointer;
  transition: r 0.2s ease, opacity 0.2s ease;
}

.reset-icon {
  cursor: pointer;
  pointer-events: all;
}

.reset-icon-circle,
.reset-icon-path {
  transition: opacity 0.2s ease;
}

.reset-text {
  cursor: pointer;
  pointer-events: all;
  transition: opacity 0.2s ease;
}
</style>

