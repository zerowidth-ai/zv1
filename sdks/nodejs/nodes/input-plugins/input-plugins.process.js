/**
 * This node simply returns the tools array injected by the engine.
 * The engine should set settings.tools to the array of tool schemas/runners.
 */
export default async ({inputs, settings, config}) => {

  // The engine should inject the available tools into settings.tools
  return {
    tools: settings.tools || []
  };
};
