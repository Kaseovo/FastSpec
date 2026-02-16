import { mount } from "@vue/test-utils";
import SaveDialog from "../SaveDialog.vue";

describe("SaveDialog", () => {
  test("renders and emits save", async () => {
    const wrapper = mount(SaveDialog, {
      props: { visible: true, specName: "MySpec", specId: null },
    });

    const input = wrapper.find("input#spec-name");
    await input.setValue("MySpec");

    await wrapper.find('button[label="Save"]').trigger("click");
    // Since the SaveDialog emits 'save' with name string, ensure emitted
    expect(wrapper.emitted("save")).toBeTruthy();
  });
});
