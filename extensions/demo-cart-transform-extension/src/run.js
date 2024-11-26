// @ts-check

/**
 * @typedef {import("../generated/api").RunInput} RunInput
 * @typedef {import("../generated/api").FunctionRunResult} FunctionRunResult
 */

/**
 * @type {FunctionRunResult}
 */
const NO_CHANGES = {
  operations: [],
};

/**
 * @param {RunInput} input
 * @returns {FunctionRunResult}
 */
export function run(input) {
  const { cart } = input;

  if (!cart || !cart.lines) {
    return NO_CHANGES;
  }

  const operations = cart.lines
    .filter((line) => {
      // Only process lines with `bundleType` in the product's metafield
      const bundleTypeMetafield = line.merchandise?.product?.bundle_type?.value;
      return (
        line.merchandise?.__typename === "ProductVariant" && bundleTypeMetafield
      );
    })
    .map((line) => {
      const { id: cartLineId, merchandise, attribute } = line;
      const bundleType = JSON.parse(merchandise.product.bundle_type.value)
        .bundleType;

      if (bundleType === "fixed") {
        // Expand logic
        const componentReferences = JSON.parse(
          merchandise.component_reference?.value || "[]"
        );
        const componentQuantities = JSON.parse(
          merchandise.component_quantities?.value || "[]"
        );

        const expandedCartItems = componentReferences.map((variantId, index) => ({
          merchandiseId: variantId,
          quantity: componentQuantities[index] || 1,
        }));

        return {
          expand: {
            cartLineId,
            expandedCartItems,
          },
        };
      } else {
        const componentReferences = JSON.parse(
          merchandise.component_reference?.value || "[]"
        );
        const componentQuantities = JSON.parse(
          merchandise.component_quantities?.value || "[]"
        );

        const valueWithDoubleQuotes = attribute?.value?.replace(/'/g, '"');
        const bundlePrices = JSON.parse(valueWithDoubleQuotes);
        console.log("bundlePrices", JSON.stringify(bundlePrices))

        const expandedCartItems = componentReferences.map((variantId, index) => {

          const matchingPrice = bundlePrices.find(priceInfo =>
            priceInfo?.variantid?.toString() === variantId?.split("/")?.pop()?.toString()
          )?.price;

          const cartItem = {
            merchandiseId: variantId,
            quantity: componentQuantities[index] || 1,
          };

          // If a matching price is found, add the price object, otherwise, return without it
          if (matchingPrice) {
            cartItem.price = {
              adjustment: {
                fixedPricePerUnit: {
                  amount: `${matchingPrice / 100}` || "0.00",
                },
              },
            };
          }

          return cartItem;
        });

        return {
          expand: {
            cartLineId,
            expandedCartItems,
          },
        };
      }
    });

  console.log("operations", operations)
  return {
    operations,
  };
}
