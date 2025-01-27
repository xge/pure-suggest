<template>
  <div id="app">
    <HeaderPanel
      id="header"
      :isMobile="isMobile"
      :selectedPublicationsCount="selectedPublications.length"
      :excludedPublicationsCount="excludedPublicationsDois.size"
      v-on:exportSession="exportSession"
      v-on:exportBibtex="exportAllBibtex"
      v-on:clearSession="clearSession"
      v-on:clearCache="clearCache"
      v-on:openAbout="isAboutPageShown = true"
      v-on:openKeyboardControls="isKeyboardControlsShown = true"
    />
    <div
      id="main"
      @click="clearActivePublication('clicked anywhere')"
      :class="{ 'network-expanded': isNetworkExpanded }"
    >
      <SelectedPublicationsComponent
        id="selected"
        ref="selected"
        :publications="selectedPublications"
        v-on:add="addPublicationsToSelection"
        v-on:startSearching="startSearchingSelected"
        v-on:searchEndedWithoutResult="endLoading"
        v-on:openSearch="openSearch"
        v-on:remove="removePublication"
        v-on:activate="activatePublicationComponentByDoi"
        v-on:showAbstract="showAbstract"
        v-on:exportSingleBibtex="exportSingleBibtex"
        v-on:updateBoost="updateBoost"
        v-on:loadExample="loadExample"
        v-on:importSession="importSession"
      />
      <SuggestedPublicationsComponent
        id="suggested"
        ref="suggested"
        :suggestion="suggestion"
        v-on:add="addPublicationsToSelection"
        v-on:remove="removePublication"
        v-on:activate="activatePublicationComponentByDoi"
        v-on:showAbstract="showAbstract"
        v-on:exportSingleBibtex="exportSingleBibtex"
        v-on:loadMore="loadMoreSuggestions"
      />
      <NetworkVisComponent
        id="network"
        ref="network"
        :selectedPublications="selectedPublications"
        :suggestedPublications="suggestion ? suggestion.publications : []"
        :isExpanded="isNetworkExpanded"
        :svgWidth="1500"
        :svgHeight="600"
        v-on:activate="activatePublicationComponentByDoi"
        v-on:expand="isNetworkExpanded = true"
        v-on:collapse="isNetworkExpanded = false"
      />
    </div>
    <QuickAccessBar id="quick-access" class="is-hidden-desktop" />
    <b-modal v-model="isSearchPanelShown">
      <SearchPanel
        :initialSearchQuery="searchQuery"
        :selectedPublicationsDois="selectedPublicationsDois"
        v-on:add="addPublicationsToSelection"
        v-on:searchEmpty="notifySearchEmpty"
      />
    </b-modal>
    <b-modal v-model="isAboutPageShown">
      <AboutPage />
    </b-modal>
    <b-modal v-model="isKeyboardControlsShown">
      <KeyboardControlsPage />
    </b-modal>
  </div>
</template>

<!---------------------------------------------------------------------------------->

<script>
import HeaderPanel from "./components/HeaderPanel.vue";
import SelectedPublicationsComponent from "./components/SelectedPublicationsComponent.vue";
import SuggestedPublicationsComponent from "./components/SuggestedPublicationsComponent.vue";
import NetworkVisComponent from "./components/NetworkVisComponent.vue";
import QuickAccessBar from "./components/QuickAccessBar.vue";
import SearchPanel from "./components/SearchPanel.vue";
import AboutPage from "./components/AboutPage.vue";
import KeyboardControlsPage from "./components/KeyboardControlsPage.vue";

import Publication from "./Publication.js";
import { saveAsFile } from "./Util.js";
import { clearCache } from "./Cache.js";

export default {
  name: "App",
  components: {
    HeaderPanel,
    SelectedPublicationsComponent,
    SuggestedPublicationsComponent,
    NetworkVisComponent,
    QuickAccessBar,
    SearchPanel,
    AboutPage,
    KeyboardControlsPage,
  },
  data() {
    return {
      selectedPublications: [],
      suggestedPublications: [],
      suggestion: undefined,
      maxSuggestions: 50,
      boostKeywords: [],
      searchQuery: "",
      excludedPublicationsDois: new Set(),
      readPublicationsDois: new Set(),
      activePublication: undefined,
      isSearchPanelShown: false,
      isAboutPageShown: false,
      isKeyboardControlsShown: false,
      isNetworkExpanded: false,
      isLoading: false,
      loadingComponent: undefined,
      isOverlay: false,
    };
  },
  computed: {
    isMobile: function () {
      return window.innerWidth <= 1023;
    },
    selectedPublicationsDois: function () {
      return this.selectedPublications.map((publication) => publication.doi);
    },
  },
  methods: {
    startSearchingSelected: function () {
      this.startLoading();
      this.updateLoadingToast(
        "Searching for publication with matching title",
        "is-primary"
      );
    },

    addPublicationsToSelection: async function (dois) {
      console.log(`Adding to selection publications with DOIs: ${dois}.`);
      document.activeElement.blur();
      if (typeof dois === "string") {
        dois = [dois];
      }
      let addedPublicationsCount = 0;
      let addedDoi = "";
      dois.forEach((doi) => {
        doi = doi.toLowerCase();
        if (this.excludedPublicationsDois.has(doi)) {
          this.excludedPublicationsDois.delete(doi);
        }
        if (!publications[doi]) {
          publications[doi] = new Publication(doi);
          addedDoi = doi;
          addedPublicationsCount++;
        }
      });
      if (addedPublicationsCount > 0) {
        await this.updateSuggestions();
        if (addedPublicationsCount == 1) {
          this.activatePublicationComponentByDoi(addedDoi);
        }
        this.$buefy.toast.open({
          message: `Added ${
            addedPublicationsCount === 1
              ? "a publication"
              : addedPublicationsCount + " publications"
          } to selected`,
        });
      } else {
        this.$buefy.toast.open({
          message: `Publication${
            dois.length > 1 ? "s" : ""
          } already in selected`,
        });
        this.endLoading();
      }
    },

    removePublication: async function (doi) {
      this.excludedPublicationsDois.add(doi);
      delete publications[doi];
      await this.updateSuggestions();
      this.$buefy.toast.open({
        message: `Excluded a publication`,
      });
    },

    updateSuggestions: async function (maxSuggestions = 50) {
      this.maxSuggestions = maxSuggestions;
      this.startLoading();
      let publicationsLoaded = 0;
      this.updateLoadingToast(
        `${publicationsLoaded}/${
          Object.keys(publications).length
        } selected publications loaded`,
        "is-primary"
      );
      this.clearActivePublication("updating suggestions");
      await Promise.all(
        Object.values(publications).map(async (publication) => {
          await publication.fetchData();
          publication.isSelected = true;
          publicationsLoaded++;
          this.updateLoadingToast(
            `${publicationsLoaded}/${
              Object.keys(publications).length
            } selected publications loaded`,
            "is-primary"
          );
        })
      );
      this.suggestion = await Publication.computeSuggestions(
        publications,
        this.excludedPublicationsDois,
        this.boostKeywords,
        this.updateLoadingToast,
        this.maxSuggestions
      );
      this.suggestion.publications.forEach((publication) => {
        publication.isRead = this.readPublicationsDois.has(publication.doi);
      });
      this.selectedPublications = Object.values(publications);
      Publication.sortPublications(this.selectedPublications);
      this.$refs.network.plot(true);
      this.endLoading();
    },

    loadMoreSuggestions: function () {
      this.updateSuggestions(this.maxSuggestions + 50);
    },

    updateBoost: async function (
      boostKeywordString,
      preventUpdateSuggestions = false
    ) {
      this.boostKeywords = boostKeywordString.toLowerCase().split(/,\s*/);
      if (!preventUpdateSuggestions) {
        await this.updateSuggestions();
      }
    },

    setBoostKeywords: async function (boostKeywordString) {
      this.$refs.selected.setBoost(boostKeywordString);
      this.updateBoost(boostKeywordString, true);
    },

    setActivePublication: function (doi) {
      this.clearActivePublication("setting active publication");
      this.selectedPublications.forEach((selectedPublication) => {
        selectedPublication.isActive = selectedPublication.doi === doi;
        if (selectedPublication.isActive) {
          this.activePublication = selectedPublication;
          this.selectedPublications.forEach((publication) => {
            publication.isLinkedToActive =
              selectedPublication.citationDois.indexOf(publication.doi) >= 0 ||
              selectedPublication.referenceDois.indexOf(publication.doi) >= 0;
          });
          this.suggestion.publications.forEach((publication) => {
            publication.isLinkedToActive =
              selectedPublication.citationDois.indexOf(publication.doi) >= 0 ||
              selectedPublication.referenceDois.indexOf(publication.doi) >= 0;
          });
        }
      });
      this.suggestion.publications.forEach((suggestedPublication) => {
        suggestedPublication.isActive = suggestedPublication.doi === doi;
        if (suggestedPublication.isActive) {
          suggestedPublication.isRead = true;
          this.readPublicationsDois.add(doi);
          this.activePublication = suggestedPublication;
          this.selectedPublications.forEach((publication) => {
            publication.isLinkedToActive =
              suggestedPublication.citationDois.indexOf(publication.doi) >= 0 ||
              suggestedPublication.referenceDois.indexOf(publication.doi) >= 0;
          });
        }
      });
      console.log(`Highlighted as active publication with DOI ${doi}.`);
    },

    clearActivePublication: function (source) {
      this.activePublication = undefined;
      this.selectedPublications
        .concat(this.suggestion ? this.suggestion.publications : [])
        .forEach((publication) => {
          publication.isActive = false;
          publication.isLinkedToActive = false;
        });
      console.log(
        `Cleared any highlighted active publication, triggered by "${source}".`
      );
    },

    activatePublicationComponent: function (publicationComponent) {
      if (publicationComponent) {
        publicationComponent.focus();
      }
    },

    activatePublicationComponentByDoi: function (doi) {
      console.log(publications[doi])
      if (doi !== this.activePublication?.doi) {
        this.activatePublicationComponent(document.getElementById(doi));
        this.setActivePublication(doi);
      }
    },

    startLoading: function () {
      if (this.isLoading) return;
      this.loadingComponent = this.$buefy.loading.open({
        container: null,
      });
      this.isLoading = true;
    },

    endLoading: function () {
      this.isLoading = false;
      if (this.loadingToast) {
        this.loadingToast.close();
        this.loadingToast = null;
      }
      if (this.loadingComponent) {
        this.loadingComponent.close();
        this.loadingComponent = null;
      }
    },

    updateLoadingToast: function (message, type) {
      if (!this.loadingToast) {
        this.loadingToast = this.$buefy.toast.open({
          indefinite: true,
        });
      }
      this.loadingToast.message = message;
      this.loadingToast.type = type;
    },

    openSearch: function (query, message) {
      this.searchQuery = query;
      this.isSearchPanelShown = true;
      if (message) {
        this.$buefy.toast.open({
          duration: 5000,
          message: message,
          type: "is-primary",
        });
      }
    },

    notifySearchEmpty: function() {
      this.$buefy.toast.open({
          duration: 5000,
          message: "No matching publications found",
          type: "is-danger",
        });
    },

    showAbstract: function (publication) {
      const _this = this;
      const onClose = function() {
        _this.isOverlay = false;
        _this.activatePublicationComponent(document.getElementById(publication.doi));
      }
      this.isOverlay = true;
      this.$buefy.dialog.alert({
        message: `<div><b>${publication.title}</b></div><div><i>${publication.abstract}</i></div>`,
        type: "is-dark",
        hasIcon: true,
        icon: "text",
        confirmText: "Close",
        canCancel: ["escape", "outside"],
        onConfirm: onClose,
        onCancel: onClose,
      });
    },

    exportSession: function () {
      let data = {
        selected: Object.keys(publications),
        excluded: Array.from(this.excludedPublicationsDois),
        boost: this.boostKeywords.join(", "),
      };
      saveAsFile("session.json", "application/json", JSON.stringify(data));
    },

    importSession: function (file) {
      const fileReader = new FileReader();
      fileReader.onload = () => {
        try {
          const content = fileReader.result;
          const session = JSON.parse(content);
          this.loadSession(session);
        } catch {
          this.showErrorMessage(`Cannot read JSON from file.`);
        }
      };
      fileReader.readAsText(file);
    },

    exportAllBibtex: function () {
      this.exportBibtex(this.selectedPublications);
    },

    exportSingleBibtex: function (publication) {
      this.exportBibtex([publication]);
    },

    exportBibtex: function (publicationList) {
      let bib = "";
      publicationList.forEach(
        (publication) => (bib += publication.toBibtex() + "\n\n")
      );
      saveAsFile("publications.bib", "application/x-bibtex", bib);
    },

    clearSession: function () {
      this.isOverlay = true;
      this.$buefy.dialog.confirm({
        message:
          "You are going to clear all selected articles and jump back to the initial state.",
        onConfirm: () => {
          publications = {};
          this.selectedPublications = [];
          this.excludedPublicationsDois = new Set();
          this.readPublicationsDois = new Set();
          this.setBoostKeywords("");
          this.updateSuggestions();
          this.isOverlay = false;
        },
        onCancel: () => {
          this.isOverlay = false;
        },
      });
    },

    clearCache: function () {
      clearCache();
      this.clearSession();
    },

    loadSession: function (session) {
      console.log(`Loading session ${JSON.stringify(session)}`);
      if (!session || !session.selected) {
        this.showErrorMessage("Cannot read session state from JSON.");
        return;
      }
      if (session.boost) {
        this.setBoostKeywords(session.boost);
      }
      if (session.excluded) {
        this.excludedPublicationsDois = new Set(session.excluded);
      }
      this.addPublicationsToSelection(session.selected);
    },

    loadExample: function () {
      const session = {
        selected: [
          "10.1109/tvcg.2015.2467757",
          "10.1109/tvcg.2015.2467621",
          "10.1002/asi.24171",
        ],
        boost: "cit, vis",
      };
      this.loadSession(session);
    },

    showErrorMessage: function (errorMessage) {
      this.$buefy.toast.open({
        duration: 5000,
        message: errorMessage,
        type: "is-danger",
      });
      console.error(errorMessage);
    },
  },

  mounted() {
    this._keyListener = function (e) {
      if (
        e.ctrlKey ||
        e.shiftKey ||
        e.metaKey ||
        (e.repeat && !(e.key === "ArrowDown" || e.key === "ArrowUp"))
      ) {
        return;
      } else if (
        this.isLoading ||
        this.isOverlay ||
        this.isSearchPanelShown &
          (document.activeElement.nodeName != "INPUT") ||
        this.isAboutPageShown ||
        this.isKeyboardControlsShown
      ) {
        e.preventDefault();
        return;
      } else if (document.activeElement.nodeName === "INPUT") {
        if (e.key === "Escape") {
          document.activeElement.blur();
        } else {
          return;
        }
      } else if (e.key === "c") {
        e.preventDefault();
        this.clearSession();
      } else if (e.key === "Escape") {
        e.preventDefault();
        document.activeElement.blur();
        this.clearActivePublication("escape key");
      } else if (e.key === "a") {
        e.preventDefault();
        this.clearActivePublication("setting focus on text field");
        document.getElementsByClassName("input add-publication")[0].focus();
      } else if (e.key === "s") {
        e.preventDefault();
        this.isSearchPanelShown = true;
      } else if (e.key === "b") {
        e.preventDefault();
        this.clearActivePublication("setting focus on text field");
        document.getElementsByClassName("input boost")[0].focus();
      } else if (e.key === "m") {
        e.preventDefault();
        this.$refs.network.toggleMode();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        this.activatePublicationComponent(
          document
            .getElementById("selected")
            .getElementsByClassName("publication-component")[0]
        );
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        this.activatePublicationComponent(
          document
            .getElementById("suggested")
            .getElementsByClassName("publication-component")[0]
        );
      } else if (this.activePublication) {
        if (e.key === "ArrowDown" || e.key === "ArrowUp") {
          e.preventDefault();
          const activePublicationComponent = document.getElementsByClassName(
            "publication-component active"
          )[0];
          this.activatePublicationComponent(
            e.key === "ArrowDown"
              ? activePublicationComponent.nextSibling
              : activePublicationComponent.previousSibling
          );
        } else if (e.key === "+") {
          e.preventDefault();
          this.addPublicationsToSelection(this.activePublication.doi);
        } else if (e.key === "-") {
          e.preventDefault();
          this.removePublication(this.activePublication.doi);
        } else if (e.key === "d") {
          e.preventDefault();
          window.open(this.activePublication.doiUrl);
        } else if (e.key === "t" && this.activePublication.abstract) {
          e.preventDefault();
          this.showAbstract(this.activePublication);
        } else if (e.key === "o" && this.activePublication.oaLink) {
          e.preventDefault();
          window.open(this.activePublication.oaLink);
        } else if (e.key === "g") {
          e.preventDefault();
          window.open(this.activePublication.gsUrl);
        } else if (e.key === "x") {
          e.preventDefault();
          this.exportSingleBibtex(this.activePublication);
        }
      }
    };

    document.addEventListener("keydown", this._keyListener.bind(this));
  },

  beforeDestroy() {
    document.removeEventListener("keydown", this._keyListener);
  },
};

// triggers a prompt before closing/reloading the page
window.onbeforeunload = function () {
  return "";
};

let publications = {};
</script>

<!---------------------------------------------------------------------------------->

<style lang="scss">
@import "~bulma/sass/utilities/_all";

$block-spacing: 0.5rem;
$box-padding: 1rem;

@import "~bulma";
@import "~buefy/src/scss/buefy";

#app {
  display: grid;
  grid-template-areas:
    "header"
    "main";
  height: 100vh;
  grid-template-rows: max-content auto;

  & #header {
    grid-area: header;
  }

  & #main {
    grid-area: main;
    margin: 0.5rem;
    display: grid;
    grid-template-areas:
      "selected suggested"
      "vis vis";
    height: calc(100% - 1rem);
    overflow: auto;

    grid-template-columns: 50fr 50fr;
    grid-template-rows: auto 35vh;
    gap: $block-spacing;

    &.network-expanded {
      grid-template-rows: auto 65vh;
    }

    & #selected {
      grid-area: selected;
      overflow-y: hidden;
    }

    & #suggested {
      grid-area: suggested;
      overflow-y: hidden;
    }

    & #network {
      grid-area: vis;
    }

    & > div {
      margin: 0;
    }
  }

  & .compact-button {
    background: transparent;
    color: $white;
    height: 1.5rem;
    margin-right: 0 !important;
    margin-left: 1rem;
    padding: 0.5rem;

    &:hover {
      color: $light;
    }
  }
}

// placed outside the #app scope to apply to tooltips also
.key {
  text-decoration: underline;
}

.unknown {
  color: $danger;
}

@include touch {
  #app {
    display: block;
    margin-bottom: 5rem;

    & #main {
      display: block;
      margin: 0;
      overflow: scroll;
      height: auto;

      & > div {
        margin: 0.25rem;
        padding: 0.5rem;
      }

      & #selected {
        min-height: 20rem;
      }

      & #suggested {
        min-height: 20rem;
      }

      & #network .box {
        min-height: 70vh;
      }

      & .level-left + .level-right {
        margin-top: 0.5rem;
      }

      /* Empty space for quick access buttons; used "::after" instead of plain margin-bottom as workaround for Chrome */
      &::after {
        content: "";
        min-height: 4rem;
        display: block;
      }
    }

    #quick-access {
      position: fixed;
      bottom: 0.5rem;
      width: 100%;
      text-align: center;
    }
  }

  // placed outside the #app scope to apply to tooltips also
  .key {
    text-decoration: none;
  }
}
</style>
