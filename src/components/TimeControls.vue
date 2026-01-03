<template>
  <div class="time-controls">
    <div class="control-group">
      <label>
        <input type="checkbox" v-model="isDemoMode" />
        Demo Mode
      </label>
    </div>
    
    <div v-if="isDemoMode" class="control-group">
      <label>
        Hours:
        <input 
          type="number" 
          v-model.number="demoHours" 
          min="0" 
          max="23" 
          class="time-input"
        />
      </label>
      <label>
        Minutes:
        <input 
          type="number" 
          v-model.number="demoMinutes" 
          min="0" 
          max="59" 
          class="time-input"
        />
      </label>
      <label>
        Seconds:
        <input 
          type="number" 
          v-model.number="demoSeconds" 
          min="0" 
          max="59" 
          class="time-input"
        />
      </label>
      <button @click="resetToCurrentTime" class="reset-btn">Reset to Current Time</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { getTimeMinutes } from '../composables/useSunCalculations';

interface Props {
  modelValue: number; // current minutes
  isDragging?: boolean; // whether sundial is being dragged
}

const props = defineProps<Props>();
const emit = defineEmits<{
  'update:modelValue': [value: number];
}>();

const isDemoMode = ref(false);
const demoHours = ref(0);
const demoMinutes = ref(0);
const demoSeconds = ref(0);

// Initialize with current time
const resetToCurrentTime = () => {
  const now = new Date();
  demoHours.value = now.getHours();
  demoMinutes.value = now.getMinutes();
  demoSeconds.value = now.getSeconds();
  updateTime();
};

// Watch for changes in demo time inputs
watch([demoHours, demoMinutes, demoSeconds], () => {
  if (isDemoMode.value) {
    updateTime();
  }
});

// Watch for dragging state - enable demo mode when dragging starts
watch(() => props.isDragging, (dragging) => {
  if (dragging && !isDemoMode.value) {
    // Dragging started, enable demo mode
    isDemoMode.value = true;
    // Sync the demo inputs with current time
    const hours = Math.floor(props.modelValue / 60);
    const mins = Math.floor(props.modelValue % 60);
    const secs = Math.floor((props.modelValue % 1) * 60);
    demoHours.value = hours;
    demoMinutes.value = mins;
    demoSeconds.value = secs;
  }
});

// Watch for time updates from external sources (like sundial drag)
// Sync demo inputs when time changes externally
watch(() => props.modelValue, (newValue, oldValue) => {
  if (oldValue !== undefined && newValue !== oldValue && isDemoMode.value) {
    // Time changed externally while in demo mode, sync inputs
    const hours = Math.floor(newValue / 60);
    const mins = Math.floor(newValue % 60);
    const secs = Math.floor((newValue % 1) * 60);
    demoHours.value = hours;
    demoMinutes.value = mins;
    demoSeconds.value = secs;
  }
});

// Watch for demo mode toggle
watch(isDemoMode, (enabled) => {
  if (enabled) {
    resetToCurrentTime();
  } else {
    // When disabling demo mode, reset to current time and let real-time take over
    const now = new Date();
    const currentMinutes = getTimeMinutes(now.getHours(), now.getMinutes(), now.getSeconds());
    emit('update:modelValue', currentMinutes);
  }
});

// When not in demo mode, sync with real time every second
// But pause when dragging
let realTimeInterval: number | null = null;
watch([isDemoMode, () => props.isDragging], ([enabled, dragging]) => {
  if (!enabled && !dragging) {
    // Start real-time sync only if not in demo mode and not dragging
    if (realTimeInterval === null) {
      realTimeInterval = setInterval(() => {
        // Double-check we're still not in demo mode or dragging
        if (!isDemoMode.value && !props.isDragging) {
          const now = new Date();
          const currentMinutes = getTimeMinutes(now.getHours(), now.getMinutes(), now.getSeconds());
          emit('update:modelValue', currentMinutes);
        }
      }, 1000) as unknown as number;
    }
  } else {
    // Stop real-time sync
    if (realTimeInterval !== null) {
      clearInterval(realTimeInterval);
      realTimeInterval = null;
    }
  }
}, { immediate: true });

const updateTime = () => {
  const totalMinutes = getTimeMinutes(demoHours.value, demoMinutes.value, demoSeconds.value);
  emit('update:modelValue', totalMinutes);
};

// Initialize
resetToCurrentTime();
</script>

<style scoped>
.time-controls {
  position: fixed;
  top: 1rem;
  right: 1rem;
  background: rgba(0, 0, 0, 0.1);
  backdrop-filter: blur(10px);
  padding: 1rem;
  border-radius: 0.5rem;
  border: 1px solid rgba(255, 255, 255, 0.1);
  z-index: 1000;
}

.control-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.control-group:last-child {
  margin-bottom: 0;
}

label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.9rem;
  opacity: 0.9;
}

.time-input {
  width: 60px;
  padding: 0.25rem 0.5rem;
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 0.25rem;
  background: rgba(255, 255, 255, 0.1);
  color: inherit;
  font-size: 0.9rem;
}

.reset-btn {
  padding: 0.5rem 1rem;
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 0.25rem;
  background: rgba(255, 255, 255, 0.1);
  color: inherit;
  cursor: pointer;
  font-size: 0.9rem;
  margin-top: 0.5rem;
}

.reset-btn:hover {
  background: rgba(255, 255, 255, 0.2);
}
</style>

