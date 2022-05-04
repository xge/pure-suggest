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
import emailjs from 'emailjs-com';

export default {
  name: "FinishStudyButton",
  methods: {
    finishStudyDialog() {
      this.$buefy.dialog.confirm({
          title: 'Finish Study',
          message: `Event Log: <pre>${getEventLog()}</pre>`,
          confirmText: 'Send Data',
          onConfirm: () => {
            try {
              emailjs.send('service_xmeebc3', 'template_1pzo6di', { log: getEventLog() }, 'TlHOLDpCvCNq7zjnL')
            } catch(error) {
                console.log({error})
            }
            this.$buefy.toast.open('Study finished. An email with the event log should be on the way now.');
          },
      })
    },
  }
}
</script>

<style>

</style>