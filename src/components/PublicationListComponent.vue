<template>
  <ul class="publication-list has-background-white">
    <PublicationComponent
      v-for="publication in publications"
      :key="publication.doi"
      :publication="publication"
      :suggestion="suggestion"
      v-on:add="addPublication"
      v-on:remove="removePublication"
      v-on:activate="activatePublication"
      v-on:showAbstract="showAbstract"
      v-on:exportBibtex="exportSingleBibtex"
    ></PublicationComponent>
  </ul>
</template>

<script>
import { scrollToTargetAdjusted } from "./../Util.js";

import PublicationComponent from "./PublicationComponent.vue";

export default {
  name: "SelectedPublicationsComponent",
  components: {
    PublicationComponent,
  },
  props: {
    publications: Array,
    suggestion: Boolean,
  },
  watch: {
    publications: {
      deep: true,
      handler: function () {
        this.$nextTick(this.scrollToActivated);
      },
    },
  },
  data() {
    return {
      onNextActivatedScroll: true,
    };
  },
  methods: {
    addPublication: function (doi) {
      this.$emit("add", doi);
    },
    removePublication: function (doi) {
      this.$emit("remove", doi);
    },
    activatePublication: function (doi) {
      this.onNextActivatedScroll = false;
      this.$emit("activate", doi);
    },
    showAbstract: function (publication) {
      this.$emit("showAbstract", publication);
    },
    exportSingleBibtex: function(publication) {
      this.$emit("exportSingleBibtex", publication);
    },
    scrollToActivated() {
      if (this.onNextActivatedScroll) {
        const publicationComponent =
          this.$el.getElementsByClassName("active")[0];
        if (publicationComponent) {
          if (window.innerWidth <= 1023)
            scrollToTargetAdjusted(publicationComponent, 65);
          else {
            publicationComponent.scrollIntoView({
              behavior: "smooth",
              block: "start",
              inline: "nearest",
            });
          }
        }
      } else {
        this.onNextActivatedScroll = true;
      }
    },
  },
};
</script>
