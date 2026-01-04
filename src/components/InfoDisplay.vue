<template>
  <div class="flex flex-col gap-1 md:text-lg">
    <table>
      <tbody>
        <tr>
          <td>Current time</td>
          <td>{{ currentTime }}</td>
        </tr>
        <tr>
          <td>Next event</td>
          <td>{{ nextEvent }}</td>
        </tr>
        <tr>
          <td>Time until</td>
          <td>{{ timeUntil }}</td>
        </tr>
        <tr>
          <td>UI Darkness</td>
          <td>{{ blendPercentage.toFixed(2) }}%</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup lang="ts">
interface Props {
  currentTime: string;
  nextEvent: string;
  timeUntil: string;
  blendPercentage: number;
}

defineProps<Props>();
</script>

<style scoped>
table {
  tr td {
    font-weight: bold;
    &:first-child {
      padding-right: 1rem;
      text-align: right;
      font-weight: normal;
    }
  }
}

</style>

