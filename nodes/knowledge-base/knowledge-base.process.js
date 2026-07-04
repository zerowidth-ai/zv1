export default async ({ inputs, settings, config }) => {
  // A pure reference/source node: it carries a KB id in its settings and emits
  // it as a `knowledge_base` handle. The runtime KB itself (the `.db`) is
  // resolved host-side (ZeroWidth's flow-runner pulls each referenced KB and
  // hands the engine an integration keyed by this uuid) — this node only names
  // which one. Consumers (semantic-search) read the uuid off the handle and
  // look up config.integrations.knowledgeBases[uuid].
  const uuid = settings?.uuid ?? null;
  if (!uuid) {
    return { knowledge_base: null };
  }
  const handle = { uuid };
  if (settings?.name) handle.name = settings.name;
  return { knowledge_base: handle };
};
