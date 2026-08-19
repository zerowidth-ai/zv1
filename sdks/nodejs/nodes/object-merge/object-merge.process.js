export default async ({ inputs, settings, config }) => {
  const objects = inputs.objects;
  const arrayMode = inputs.array_mode ?? "replace";

  // Normalize to a flat array. A single connection can deliver an array of
  // objects, and a multi-connection input can deliver arrays alongside plain
  // objects, so flatten one level before filtering.
  const objectList = (Array.isArray(objects) ? objects : [objects]).flatMap(
    (entry) => (Array.isArray(entry) ? entry : [entry])
  );

  // Filter out non-objects
  const validObjects = objectList.filter(
    (obj) => obj !== null && typeof obj === "object" && !Array.isArray(obj)
  );

  if (validObjects.length === 0) {
    return { merged: {} };
  }

  const isPlainObject = (val) =>
    val !== null && typeof val === "object" && !Array.isArray(val);

  const deepMerge = (target, source) => {
    const result = { ...target };

    for (const key of Object.keys(source)) {
      const targetVal = target[key];
      const sourceVal = source[key];

      if (Array.isArray(sourceVal)) {
        if (arrayMode === "concat" && Array.isArray(targetVal)) {
          result[key] = [...targetVal, ...sourceVal];
        } else {
          result[key] = [...sourceVal];
        }
      } else if (isPlainObject(sourceVal)) {
        if (isPlainObject(targetVal)) {
          result[key] = deepMerge(targetVal, sourceVal);
        } else {
          result[key] = deepMerge({}, sourceVal);
        }
      } else {
        result[key] = sourceVal;
      }
    }

    return result;
  };

  let merged = {};
  for (const obj of validObjects) {
    merged = deepMerge(merged, obj);
  }

  return { merged };
};
