import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import PrimeVue from "primevue/config";
import ConfirmationService from "primevue/confirmationservice";
import SaveDialog from "../SaveDialog.vue";

// Stub PrimeVue and child components so the Dialog content renders inline
const globalStubs = {
  Dialog: {
    props: ["visible", "modal", "header"],
    template: "<div v-if=\"visible\"><slot /><slot name=\"footer\" /></div>",
  },
  Button: {
    props: ["label", "loading", "disabled"],
    template: '<button :label="label" :disabled="disabled" @click="$emit(\'click\')">{{ label }}</button>',
    emits: ["click"],
  },
  InputText: {
    props: ["modelValue", "id"],
    template: '<input :id="id" :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />',
    emits: ["update:modelValue"],
  },
  Tag: { template: "<span><slot /></span>" },
  SelectButton: { template: "<div />" },
  DiffDrawer: { template: "<div />" },
  LintPanel: { template: "<div />" },
};

describe("SaveDialog", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  test("renders input with spec name", () => {
    const wrapper = mount(SaveDialog, {
      props: { visible: true, specName: "MySpec", specId: null },
      global: {
        plugins: [PrimeVue, ConfirmationService],
        components: globalStubs,
      },
    });

    const input = wrapper.find("input#spec-name");
    expect(input.exists()).toBe(true);
    expect(input.element.value).toBe("MySpec");
  });

  test("shows Compare & Confirm button in footer", () => {
    const wrapper = mount(SaveDialog, {
      props: { visible: true, specName: "MySpec", specId: null },
      global: {
        plugins: [PrimeVue, ConfirmationService],
        components: globalStubs,
      },
    });

    const btn = wrapper.find('button[label="Compare & Confirm"]');
    expect(btn.exists()).toBe(true);
  });
});
