import { json, redirect } from "@remix-run/node";
import { useActionData, useLoaderData, useSubmit } from "@remix-run/react";
import { useState, useCallback, useEffect, useRef } from "react";
import { authenticate } from "../shopify.server";
import {
  Page,
  Layout,
  Card,
  TextField,
  Button,
  Text,
  BlockStack,
  Box,
  Thumbnail,
  Banner,
  EmptyState,
  InlineStack,
  Badge,
  ChoiceList,
} from "@shopify/polaris";
import { ImageIcon, DeleteIcon } from "@shopify/polaris-icons";
import emptyState from "../assets/emptyState/newBundle.svg";
import { updateChildVariantMetafields } from "../services/updateChildVariantMetafields";
import createFetchBundleProductQuery from "../graphql/fetchBundleProduct";

// Helper to get variants based on selected option values
const getVariantsForSelectedOptions = (variants, options) => {
   
    const selectedOptionMap = options
      .filter(option => option.values.length > 0) // Only consider options that have multiple values
      .map(option => new Set(option.values.filter(value => !option.disabledValues?.includes(value)))); // Use Set for fast lookups

  
    // Filter variants based on selected options
    const filteredVariants = variants.filter(variant => {
      // Check if every selected option has a matching value in the variant
      return variant.selectedOptions.every((variantOption, index) => {
        const selectedValues = selectedOptionMap[index];  // Get the corresponding selected values Set by index
        
        // If no corresponding selected values Set exists, skip the variant
        if (!selectedValues) return false;
  
        // Check if the variant's value exists in the selected values Set
        return selectedValues.has(variantOption.value);
      });
    });
  
    return filteredVariants
};

const cartesianProduct = (arrays) => {
  return arrays.reduce((acc, array) =>
    acc.flatMap((x) => array.map((y) => [...x, y]))
  , [[]]);
};

export async function loader({ params, request }) {
  const { id } = params;
  const { admin } = await authenticate.admin(request);
  
  const fetchBundleProductQuery = createFetchBundleProductQuery(id);

  const productResponse = await admin.graphql(fetchBundleProductQuery);
  const productJson = await productResponse.json();

  const productId = productJson?.data?.product?.id
  const productTitle = productJson?.data?.product?.title
  let bundle = productJson?.data?.product?.bundle?.value
  if(bundle){
    const jsonBundle = JSON.parse(bundle)
    bundle = jsonBundle?.products
  }
  let productBundleType = productJson?.data?.product?.bundleType?.value
  if(productBundleType){
    const jsonBundleType = JSON.parse(productBundleType)
    productBundleType = jsonBundleType?.bundleType
  }

  return json({
    productId,
    productTitle,
    productBundleType,
    bundle
  });
}

export async function action({ request }) {
  const { admin } = await authenticate.admin(request);
  const formData = await request.formData();
  const title = formData.get("title");
  const products = JSON.parse(formData.get("products"));
  const bundleType = formData.get("bundleType");
  const updateProductId = formData.get("productId");

  // Validate basic requirements
  if (!title) return json({ errors: ["Title is required"] });
  if (products.length === 0) return json({ errors: ["At least one product is required"] });
  if (products.length > 30) return json({ errors: ["Maximum 30 products allowed"] });

  let positionCounter = 1;
  const allOptionsWithDetails = products
    .filter(product => product.selectedVariants.length > 1)
    .flatMap((product) =>
      product.options
        .map((option) => {
          const filteredValues = option.values
            .filter(value => !option.disabledValues || !option.disabledValues.includes(value));

          // Only include options with more than one valid value
          if (filteredValues.length > 1) {
            return {
              position: positionCounter++, // Use the external counter and increment
              name: `${option.name} - (${product.title})`,
              values: filteredValues.map(value => ({ name: value }))
            };
          }
          return null; // Exclude options with 1 or 0 values
        })
        .filter(Boolean) // Remove null entries
    );
  // Create all possible combinations of option values
  const optionCombinations = cartesianProduct(
    allOptionsWithDetails.map(option => 
      option.values.map(value => ({
        name: value.name,
        optionName: option.name
      }))
    )
  );

  if (allOptionsWithDetails.length > 3) {
    return json({ errors: ["Bundle cannot have more than 3 options total"] });
  }

  const totalVariants = products.reduce((acc, product) => 
    acc * product.selectedVariants.length, 0);

  if (totalVariants > 100) {
    return json({ errors: ["Total variant combinations cannot exceed 100"] });
  }

  try {  
    const variantGroups = products.map((product) => product.selectedVariants);
    const allCombinations = cartesianProduct(variantGroups);
    
    // Check if we need to create a product with options
    const hasMultipleVariants = allOptionsWithDetails.length > 0;
  
    let productInput;
    if (!hasMultipleVariants) {
        const defaultVariant = {
          optionValues: [
            {
              "name": "Default Title",
              "optionName": "Title"
            }
          ],
          requiresComponents: true,
          inventoryPolicy: "CONTINUE",
          price: products.reduce((total, product) => 
            total + parseFloat(product.selectedVariants[0].price), 0),
          compareAtPrice: products.reduce((total, product) => 
            total + (parseFloat(product.selectedVariants[0].compareAtPrice) || 0), 0),
          metafields: [
            {
              namespace: "custom",
              key: "component_quantities",
              type: "list.number_integer",
              value: JSON.stringify(products.map(p => p.bundleQuantity)),
            },
            {
              namespace: "custom",
              key: "component_reference",
              type: "list.variant_reference",
              value: JSON.stringify(products.map(p => p.selectedVariants[0].id)),
            },
          ],
        };
      
        productInput = {
          synchronous: true,
          productSet: {
            id: updateProductId,
            title: title,
            claimOwnership: {
              bundles: true
            },
            productOptions: [
              {
                "position": 1,
                "name": "Title",
                "values": [
                  {
                    "name": "Default Title"
                  }
                ]
              }
            ],
            templateSuffix: "bundle",
            variants: [defaultVariant],
            metafields: [
              {
                namespace: "custom",
                key: "bundle",
                type: "single_line_text_field",
                value: bundleType,
              },
              {
                namespace: "$app:bundle",
                key: "bundle-configuration",
                type: "json",
                value: JSON.stringify({
                  products,
                }),
              },
              {
                namespace: "$app:bundleType",
                key: "bundleType-configuration",
                type: "json",
                value: JSON.stringify({
                  bundleType
                }),
              }
            ],
          },
        };
      
      
    } else {

      const bundleVariants = allCombinations.map((combination, index) => {
        const componentReference = combination.map((variant) => variant.id);
        const componentQuantities = combination.map((_, i) => products[i].bundleQuantity);
        const combinedPrice = combination.reduce(
          (total, variant) => total + parseFloat(variant.price),
          0
        );
        const combinedCompareAtPrice = combination.reduce(
          (total, variant) => total + (parseFloat(variant.compareAtPrice) || 0),
          0
        );
    
        return {
          optionValues: optionCombinations[index],
          requiresComponents: true,
          inventoryPolicy: "CONTINUE",
          price: combinedPrice,
          compareAtPrice: combinedCompareAtPrice,
          metafields: [
            {
              namespace: "custom",
              key: "component_quantities",
              type: "list.number_integer",
              value: JSON.stringify(componentQuantities),
            },
            {
              namespace: "custom",
              key: "component_reference",
              type: "list.variant_reference",
              value: JSON.stringify(componentReference),
            },
          ],
        };
      });
      
      productInput = {
        synchronous: true,
        productSet: {
          id: updateProductId,
          title: title,
          claimOwnership: {
            bundles: true
          },
          productOptions: allOptionsWithDetails,
          ...(bundleType === 'customizable' && { templateSuffix: "bundle" }),
          variants: bundleVariants,
          metafields: [
            {
              namespace: "custom",
              key: "bundle",
              type: "single_line_text_field",
              value: bundleType,
            },
            {
              namespace: "$app:bundle",
              key: "bundle-configuration",
              type: "json",
              value: JSON.stringify({
                products,
              }),
            },
            {
              namespace: "$app:bundleType",
              key: "bundleType-configuration",
              type: "json",
              value: JSON.stringify({
                bundleType
              }),
            }
          ],
        },
      };
    }

    // if (productInput){
    //   console.log("productInput", JSON.stringify(productInput))
    //   return json({
    //     status: "failed",
    //     productId: null,
    //     data: productInput
    //   });
    // }


    const response = await admin.graphql(`
      mutation createBundleProduct($productSet: ProductSetInput!, $synchronous: Boolean!) {
        productSet(synchronous: $synchronous, input: $productSet) {
          product {
            id
            title
            variants(first: 100) {
              nodes {
                id
                metafields(first: 2, keys: ["custom.component_reference", "custom.component_quantities"]) {
                  edges {
                    node {
                      namespace
                      key
                      value
                    }
                  }
                }
              }
            }
          }
          userErrors {
            field
            message
          }
        }
      }
    `, {
      variables: productInput
    });

    const responseJson = await response.json();

    const parentVariants = responseJson.data.productSet.product.variants.nodes.map((variant) => ({
      id: variant.id,
      metafields: variant.metafields.edges.map((edge) => edge.node),
    }));

    if (responseJson.data?.productCreate?.userErrors?.length > 0) {
      throw new Error(responseJson.data.productCreate.userErrors[0].message);
    }

    // await updateChildVariantMetafields(admin, parentVariants, products);

    const productId = responseJson?.data?.productSet?.product?.id?.split("/")?.pop();
    if (responseJson.data){
      return json({
        status: "success",
        productId: productId,
        data: responseJson.data
      });
    }

    return redirect("/app");

  } catch (error) {
    console.error("Bundle creation error:", error);
    return json({
      errors: ["Failed to update bundle. Please try again."]
    });
  }
}

export default function BundleNew() {
  const { productId, productTitle, productBundleType, bundle } = useLoaderData();
  const actionData = useActionData();
  const [title, setTitle] = useState(productTitle);
  const [products, setProducts] = useState(bundle);
  const [bundleType, setBundleType] = useState([productBundleType]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaveEnabled, setIsSaveEnabled] = useState(false);
  const hasMounted = useRef(false);
  
  const submit = useSubmit();
  const handleProductPicker = async () => {
    const picked = await window.shopify.resourcePicker({
      type: "product",
      multiple: true,
      selectionIds: products.map((p) => ({ id: p.id })),
      filter: {
        variants: false,
        draft: false,
        archived: false,
      },
    });

    if (picked) {
      const selectedProducts = picked.map(product => {
        const existingProduct = products.find(p => p.id === product.id);
 
        if (existingProduct) {
            return existingProduct;
        }
        // Initialize options - first value selected but others enabled
        const options = product.options.map(option => ({
          ...option,
          // Only disable values for default options (single value options)
          disabledValues: option.values.length === 1 ? option.values.slice(1) : [],
          values: option.values,
        }));

        // Get initial variants based on selected options
        const initialVariants = getVariantsForSelectedOptions(product.variants, options);

        return {
          ...product,
          bundleQuantity: existingProduct?.bundleQuantity || 1,
          options: options,
          variants: product.variants,
          selectedVariants: initialVariants,
        };
      });

      setProducts(selectedProducts);
    }
  };

  const handleQuantityChange = (productId, newQuantity) => {
    setProducts(currentProducts => 
      currentProducts.map(product => 
        product.id === productId 
          ? { ...product, bundleQuantity: parseInt(newQuantity, 10) } 
          : product
      )
    );
  };

  const handleOptionValueToggle = (productId, optionId, value) => {
    setProducts(currentProducts => 
      currentProducts.map(product => {
        if (product.id !== productId) return product;

        const updatedOptions = product.options.map(option => {
          if (option.id !== optionId) return option;

          let disabledValues = [...(option.disabledValues || [])];
          
          if (disabledValues.includes(value)) {
            // Enable the value - always allow enabling values
            disabledValues = disabledValues.filter(v => v !== value);
          } else {
            // Only disable if there will still be at least one value enabled
            const currentlyEnabled = option.values.length - disabledValues.length;
            if (currentlyEnabled > 1) {
              disabledValues.push(value);
            }
          }

          return {
            ...option,
            disabledValues,
          };
        });

        // Update selected variants based on new option selections
        const selectedVariants = getVariantsForSelectedOptions(product.variants, updatedOptions);

        return {
          ...product,
          options: updatedOptions,
          selectedVariants,
        };
      })
    );
  };

  const handleSubmit = useCallback(() => {
    if (!title || products.length === 0) return;

    setIsLoading(true);
    const formData = new FormData();
    formData.set("productId", productId);
    formData.set("title", title);
    formData.set("products", JSON.stringify(products));
    formData.set("bundleType", bundleType[0]);
    submit(formData, { method: "POST" });
  }, [productId, title, products, bundleType, submit]);

  const handleDeleteProduct = useCallback((productId) => {
    setProducts(currentProducts => 
      currentProducts.filter(product => product.id !== productId)
    );
  }, []);

  const handleChange = useCallback((value) => setBundleType(value), []);

  const errorBanner = actionData?.errors?.length > 0 ? (
    <Layout.Section>
      <Banner tone="critical">
        <BlockStack gap="200">
          <Text>There were some issues with your form submission:</Text>
          <ul>
            {actionData.errors.map((error, index) => (
              <li key={index}>
                <Text as="span">{error}</Text>
              </li>
            ))}
          </ul>
        </BlockStack>
      </Banner>
    </Layout.Section>
  ) : null;


  useEffect(() => {
    // Compare products, bundleType, and title with their initial values
    const productsChanged = JSON.stringify(products) !== JSON.stringify(bundle);
    const bundleTypeChanged = JSON.stringify(bundleType) !== JSON.stringify([productBundleType]); 
    const titleChanged = JSON.stringify(title.trim()) !== JSON.stringify(productTitle.trim());

    if (productsChanged || bundleTypeChanged || titleChanged) {
      setIsSaveEnabled(true);
    } else {
      setIsSaveEnabled(false);
    }
  }, [products, bundleType, title, bundle, productTitle, productBundleType ]);

  useEffect(() => {
    if (!actionData) return;
    if (actionData) {
      setIsLoading(false);
    }
    if (actionData?.status === "success" && actionData.productId) {
      window.open(`shopify://admin/products/${actionData.productId}`, '_self');
    }
  }, [actionData]);
  
  const handleRedirect = useCallback(() => {
    return window.open('/app', '_self');
  }, []);

  return (
    <Page
      title="Edit bundle"
      backAction={{
        content: "Bundles",
        onAction: handleRedirect,
      }}
      secondaryActions={[
        {
          content: "View Bundle Product",
          onAction: () => window.open(`shopify://admin/products/${productId.split("/").pop()}`, '_self'),
        },
      ]}
    >

      <Layout>

        {errorBanner}
        <Layout.Section>
          <BlockStack gap="400">
            <Card>
              <BlockStack gap="400">
                <TextField
                  label="Title"
                  value={title}
                  onChange={setTitle}
                  autoComplete="off"
                  placeholder="T-Shirt Bundle"
                />
                
                <ChoiceList
                  title="Bundle Type"
                  choices={[
                    {
                      label: 'Fixed Bundle',
                      value: "fixed",
                    },
                    {
                      label: 'Customizable Bundle',
                      value: "customizable",
                    },
                  ]}
                  selected={bundleType}
                  onChange={handleChange}
                />
              </BlockStack>
            </Card>

            <Card>
              {products.length > 0 ? (
                <BlockStack gap="400">
                  <InlineStack align="space-between">
                    <Text variant="headingMd">Products</Text>
                    <Button onClick={handleProductPicker}>Add Products</Button>
                  </InlineStack>

                  <Banner status="info">
                    <Text as="span">
                      {products.length}/30 bundled products
                    </Text>
                  </Banner>

                  {products.map(product => (
                    <Box
                      key={product.id}
                      padding="400"
                      borderColor="border"
                      borderWidth="025"
                      borderRadius="200"
                    >
                      <BlockStack gap="400">
                        <InlineStack gap="400" align="space-between" blockAlign="center">
                          <InlineStack gap="400">
                            <Thumbnail
                              source={product.images[0]?.originalSrc || ImageIcon}
                              alt={product.title}
                            />
                            <BlockStack gap="100">
                              <Text variant="bodyMd" fontWeight="bold">
                                {product.title}
                              </Text>
                              <Badge>{product.selectedVariants?.length || 0} variants</Badge>
                            </BlockStack>
                          </InlineStack>
                          
                          <InlineStack gap="400" align="center" blockAlign="center">
                            <TextField
                              type="number"
                              value={product.bundleQuantity.toString()}
                              onChange={(value) => handleQuantityChange(product.id, value)}
                              min={1}
                              autoComplete="off"
                              label="Quantity"
                              labelHidden
                            />
                            <Button
                              icon={DeleteIcon}
                              tone="critical"
                              variant="plain"
                              onClick={() => handleDeleteProduct(product.id)}
                              accessibilityLabel={`Remove ${product.title} from bundle`}
                            />
                          </InlineStack>
                        </InlineStack>

                        {product.options
                          .filter(option => option.values.length > 1)
                          .map(option => {
                            // Calculate selected values for this option
                            const selectedValues = option.values
                              .filter(value => !option.disabledValues?.includes(value));
                            const onlyOneSelected = selectedValues.length === 1;

                            return (
                              <BlockStack key={option.id} gap="200">
                                <Text variant="bodyMd">
                                  {option.name}
                                  <Text variant="bodySm" color="subdued">
                                    {" "}({selectedValues.length} selected)
                                  </Text>
                                </Text>
                                <InlineStack gap="200" wrap={false}>
                                  {option.values.map((value) => {
                                    const isDisabled = option.disabledValues?.includes(value);
                                    const isSelected = !isDisabled;
                                    
                                    return (
                                      <Button
                                        key={value}
                                        onClick={() => handleOptionValueToggle(product.id, option.id, value)}
                                        variant={isDisabled ? "secondary" : "primary"}
                                        disabled={onlyOneSelected && isSelected}
                                      >
                                        {value}
                                      </Button>
                                    );
                                  })}
                                </InlineStack>
                              </BlockStack>
                            );
                          })}
                      </BlockStack>
                    </Box>
                  ))}
                </BlockStack>
              ) : (
                <EmptyState
                  image={emptyState}
                  heading="Select products"
                  action={{
                    content: "Select products",
                    onAction: handleProductPicker,
                  }}
                >
                    <Text variant="bodySm" color="subdued">
                        Select the products you want to bundle.
                    </Text>
                </EmptyState>
              )}
            </Card>
          </BlockStack>
        </Layout.Section>

        <Layout.Section variant="oneThird">
        <Card>
          <BlockStack gap="400">
    
              <BlockStack gap="400">
                <Text variant="headingMd">Components</Text>
                <Text variant="bodyMd" color="subdued">
                  Bundles can include up to 30 different products. Limits for bundle options and variants are the same as other products.
                </Text>
                
                <BlockStack gap="200">
                  <Text>{products.length}/30 bundled products</Text>
                  <Text>
                    {(() => {
                      // Use the same logic as allOptionsWithDetails to count options
                      const optionsCount = products
                        .filter(product => product.selectedVariants.length > 1)
                        .reduce((acc, product) => {
                          const validOptions = product.options
                            .filter(option => {
                              const filteredValues = option.values
                                .filter(value => !option.disabledValues || !option.disabledValues.includes(value));
                              return filteredValues.length > 1;
                            });
                          return acc + validOptions.length;
                        }, 0);
                      
                      return `${optionsCount}/3 options`;
                    })()}</Text>
                  <Text>
                    {products.reduce((acc, p) => acc * (p.selectedVariants?.length || 0), products.length === 0 ? 0 : 1)}/100 variants
                  </Text>
                </BlockStack>
              </BlockStack>

            {products.some(p => p.selectedVariants?.length > 1) && (
              <BlockStack gap="400">
                <Text variant="headingMd">Options</Text>
                <Text variant="bodyMd" color="subdued">
                  Buyers will be able to choose from these options.
                </Text>
                <BlockStack gap="400">
                  {(() => {
                    let positionCounter = 1;
                    const optionsWithDetails = products
                      .filter(product => product.selectedVariants.length > 1)
                      .flatMap((product) =>
                        product.options
                          .map((option) => {
                            const filteredValues = option.values
                              .filter(value => !option.disabledValues || !option.disabledValues.includes(value));

                            // Only include options with more than one valid value
                            if (filteredValues.length > 1) {
                              return {
                                position: positionCounter++,
                                name: `${option.name} - (${product.title})`,
                                values: filteredValues
                              };
                            }
                            return null;
                          })
                          .filter(Boolean)
                      );

                    return optionsWithDetails.map(option => (
                      <BlockStack key={option.name} gap="200">
                        <Text variant="bodyMd" fontWeight="bold">
                          {option.name}
                        </Text>
                        <InlineStack gap="200" wrap>
                          {option.values.map(value => (
                            <Badge key={value} tone="info">
                              {value}
                            </Badge>
                          ))}
                        </InlineStack>
                      </BlockStack>
                    ));
                  })()}
                </BlockStack>
              </BlockStack>
            )}

            <Button
              variant="primary"
              tone="success"
              onClick={handleSubmit}
              disabled={!title || !isSaveEnabled || products.length === 0}
              loading={isLoading}
              fullWidth
            >
              Save and continue
            </Button>

          </BlockStack>
          </Card>

        </Layout.Section>
      </Layout>
    </Page>
  );
} 