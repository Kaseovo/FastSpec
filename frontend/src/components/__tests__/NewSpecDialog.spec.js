import { flushPromises, mount } from "@vue/test-utils";
import PrimeVue from "primevue/config";
import NewSpecDialog from "../NewSpecDialog.vue";

function mountDialog() {
  return mount(NewSpecDialog, {
    props: { visible: true },
    attachTo: document.body,
    global: { plugins: [PrimeVue] },
  });
}

const button = (label) =>
  [...document.body.querySelectorAll("button")].find((b) => b.textContent.includes(label));

test("offers the example, an import and a blank spec", async () => {
  const wrapper = mountDialog();
  await flushPromises();

  button("Example").click();
  button("Blank").click();

  expect(wrapper.emitted("example")).toHaveLength(1);
  expect(wrapper.emitted("blank")).toHaveLength(1);
});

test("imports pasted YAML", async () => {
  const wrapper = mountDialog();
  await flushPromises();
  button("Import").click();
  await flushPromises();

  const textarea = document.body.querySelector("#import-paste");
  textarea.value = "openapi: 3.0.3\ninfo:\n  title: Orders\n  version: 1.0.0\npaths: {}\n";
  textarea.dispatchEvent(new Event("input"));
  await flushPromises();
  [...document.body.querySelectorAll("button")].filter((b) => b.textContent.includes("Import")).pop().click();
  await flushPromises();

  const [[result]] = wrapper.emitted("import");
  expect(result.name).toBe("Orders");
  expect(result.spec.info.version).toBe("1.0.0");
});

test("explains why an import was refused", async () => {
  const wrapper = mountDialog();
  await flushPromises();
  button("Import").click();
  await flushPromises();

  const textarea = document.body.querySelector("#import-paste");
  textarea.value = "swagger: '2.0'\ninfo: {title: Old, version: '1'}\n";
  textarea.dispatchEvent(new Event("input"));
  await flushPromises();
  [...document.body.querySelectorAll("button")].filter((b) => b.textContent.includes("Import")).pop().click();
  await flushPromises();

  expect(wrapper.emitted("import")).toBeUndefined();
  expect(document.body.textContent).toContain("Swagger 2.0");
});

test("refuses files over 5 MB", async () => {
  const wrapper = mountDialog();
  await flushPromises();
  button("Import").click();
  await flushPromises();

  const input = document.body.querySelector("[data-testid=import-file]");
  const big = new File(["x"], "huge.yaml");
  Object.defineProperty(big, "size", { value: 6 * 1024 * 1024 });
  Object.defineProperty(input, "files", { value: [big] });
  input.dispatchEvent(new Event("change"));
  await flushPromises();

  expect(wrapper.emitted("import")).toBeUndefined();
  expect(document.body.textContent).toContain("larger than 5 MB");
});
