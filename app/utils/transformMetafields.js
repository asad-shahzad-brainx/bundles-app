export const transformMetafields = (currentMetafields, relevantParents) => {
  // Parse existing metafields or initialize as an empty array
  const existingComponentParents = currentMetafields ? JSON.parse(currentMetafields) : [];

  // Create new component parents from relevant parents
  const newComponentParents = relevantParents.map((parentVariant) => {
    const componentReference = parentVariant.metafields.find(
      (mf) => mf.namespace === "custom" && mf.key === "custom.component_reference"
    );
    const componentQuantities = parentVariant.metafields.find(
      (mf) => mf.namespace === "custom" && mf.key === "custom.component_quantities"
    );

    return {
      id: parentVariant.id || null,
      component_reference: {
        value: componentReference?.value ? JSON.parse(componentReference.value) : [],
      },
      component_quantities: {
        value: componentQuantities?.value ? JSON.parse(componentQuantities.value) : [],
      },
    };
  });

  // Merge existing and new component parents
  return JSON.stringify([...existingComponentParents, ...newComponentParents]);
};
