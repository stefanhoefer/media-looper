import AdminWrapper from "@/entrypoints/admin/AdminWrapper.svelte";

const app = new AdminWrapper({
  target: document.getElementById('app')!,
});

export default app;
