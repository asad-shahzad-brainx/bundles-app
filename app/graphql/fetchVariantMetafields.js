const fetchVariantMetafieldsQuery = (selectedVariants) => {
    const variantQueries = selectedVariants
      .map(
        (variant, index) => `
      productVariant${index}: productVariant(id: "${variant.id}") {
        id
        title
        metafield(key: "component_parents", namespace: "custom") {
          value
        }
      }`
      )
      .join("\n");
  
    return `
      query {
        ${variantQueries}
      }
    `;
  };
  
  export default fetchVariantMetafieldsQuery;
  