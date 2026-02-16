import { mount } from "@vue/test-utils";
import DiffDrawer from "../DiffDrawer.vue";

describe("DiffDrawer", () => {
  test("renders no-changes message when diff empty", () => {
    const wrapper = mount(DiffDrawer, {
      props: {
        diff: { info: null, added: [], modified: [], removed: [] },
        inline: true,
      },
    });

    expect(wrapper.text()).toContain("No Changes");
  });
});
