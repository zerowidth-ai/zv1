export default async ({inputs, settings, config}) => {

  const items = inputs.items;

  let array = [];
  if (Array.isArray(items)) {
    array = items;
  } else {
    array = [items];
  }

  return { array };
};
