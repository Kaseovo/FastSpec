import { enableAutoUnmount } from "@vue/test-utils";

// Unmount every wrapper after each test. Components keep timers running
// otherwise (e.g. PrimeVue TabList's ink-bar update), which then fire after
// the jsdom environment is torn down and fail the run intermittently.
enableAutoUnmount(afterEach);
