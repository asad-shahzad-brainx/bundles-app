import fetchVariantMetafieldsQuery from "../graphql/fetchVariantMetafields.js";
import bulkUpdateVariantMetafieldsMutation from "../graphql/bulkUpdateVariantMetafields.js";
import { transformMetafields } from "../utils/transformMetafields.js";

export const updateChildVariantMetafields = async (admin, parentVariants, products) => {
 
  // Step 1: Fetch metafields for selected variants
  const allSelectedVariants = products.flatMap((product) => product.selectedVariants);
  const query = fetchVariantMetafieldsQuery(allSelectedVariants);

  let currentMetafields;
  try {
    const response = await admin.graphql(query);
    currentMetafields = await response.json();
  } catch (error) {
    throw error;
  }

  // Step 2: Prepare and perform bulk updates
  const productUpdates = products.map((product) => {
    const bulkInput = product.selectedVariants.map((variant) => {
      const currentMetafield = currentMetafields?.data[`productVariant${allSelectedVariants.indexOf(variant)}`]?.metafield?.value;

      const relevantParents = parentVariants.filter((parentVariant) => {
        const componentReferenceMetafield = parentVariant.metafields.find(
          (mf) => mf.namespace === "custom" && mf.key === "custom.component_reference"
        );
        return (
          componentReferenceMetafield &&
          JSON.parse(componentReferenceMetafield.value).includes(variant.id)
        );
      });

      console.log("relevantParents", relevantParents)

      return {
        id: variant.id,
        metafields: [
          {
            namespace: "custom",
            key: "component_parents",
            value: transformMetafields(currentMetafield, relevantParents),
            type: "json",
          },
        ],
      };
    });

    return {
      productId: product.id,
      variants: bulkInput,
    };
  });

  // Step 3: Execute mutations for each product
  for (const { productId, variants } of productUpdates) {
    try {
      console.log("variants", variants[0].metafields[0].value)
      const response = await admin.graphql(bulkUpdateVariantMetafieldsMutation, {
        variables: { productId, variants },
      });
      const responseJson = await response.json();
    } catch (error) {
      throw error;
    }
  }
};
