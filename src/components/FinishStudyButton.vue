<template>
  <b-button
    class="is-primary"
    @click="finishStudyDialog"
  >
    Finish Study
  </b-button>
</template>

<script>
import { getEventLog } from '@/Logging';

export default {
  name: "FinishStudyButton",
  methods: {
    finishStudyDialog() {
      this.$buefy.dialog.confirm({
          title: 'Finish Study',
          message: `Event Log: <pre>${getEventLog()}</pre>`,
          confirmText: 'Send Data',
          onConfirm: () => {
            this.$buefy.toast.open('Study finished. So far this is a dummy, but it should send the data now.');
          },
      })
    },
  }
}
</script>

<style>

</style>