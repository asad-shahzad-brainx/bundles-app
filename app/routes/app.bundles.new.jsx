import {
  Card,
  Page,
  BlockStack,
  Layout,
  TextField,
  EmptyState,
  InlineStack,
  Button,
  Text,
  Box,
  Thumbnail,
  Form,
  InlineError,
  Banner,
  Badge,
} from "@shopify/polaris";
import { useState, useCallback } from "react";
import emptyState from "../assets/emptyState/newBundle.svg";
import { ImageIcon, CheckIcon } from "@shopify/polaris-icons";
import { authenticate } from "../shopify.server";
import { json } from "@remix-run/node";
import { useActionData, useSubmit } from "@remix-run/react";

export async function action({ request }) {
  const { admin } = await authenticate.admin(request);
  const formData = await request.formData();
  const bundleTitle = formData.get("title");
  const bundleComponents = JSON.parse(formData.get("products"));

  const defaultBundleOptions = [
    {
      name: "Bundle Option",
      values: [
        {
          name: "Default",
        },
      ],
    },
  ];

  // const customBundleOptions = [];
  // bundleComponents.map((component) => {
  //   if (component.options.values.length === 1) return null;
  //   component.options.map(({ name, values }) => {
  //     const optionValue = values.map((value) => {
  //       return {
  //         name: value,
  //       };
  //     });
  //     customBundleOptions.push({
  //       name: `${component.title} (${name})`,
  //       values: optionValue,
  //       position: customBundleOptions.length + 1,
  //     });
  //   });
  // });

  const customBundleOptions = [];
  bundleComponents.forEach((component) => {
    component.options.forEach(({ name, values, selectedValues }) => {
      console.log("selected", selectedValues, " values", values);
      if (selectedValues.length > 1) {
        const optionValue = selectedValues.map((value) => ({ name: value }));

        customBundleOptions.push({
          name: `${component.title} (${name})`,
          values: optionValue,
          position: customBundleOptions.length + 1,
        });
      }
    });
  });

  const bundleComponentVariants = bundleComponents.map(({ variants }) => {
    return variants.map((variant) => variant.id);
  });

  return json({ customBundleOptions, bundleComponentVariants });

  const totalVariants = customBundleOptions.reduce((acc, curr) => {
    return acc * curr.values.length;
  }, 1);

  if (customBundleOptions.length > 3 || totalVariants > 100) {
    return json({
      totalVariants,
      options: customBundleOptions,
      error: [
        "A bundle cannot have more than 3 options or 100 variants. Reduce options by setting a single value for 1 or more options",
      ],
    });
  }

  const bundlePrice = bundleComponents.reduce((acc, curr) => {
    return (
      acc +
      curr.variants.reduce((acc, variant) => acc + Number(variant.price), 0)
    );
  }, 0);

  const bundleComponentsQuantities = bundleComponents.map((component) =>
    component.bundleQuantity.toString(),
  );

  const cartesian = (...arrays) =>
    arrays.reduce((a, b) => a.flatMap((d) => b.map((e) => [d, e].flat())));

  function generateCombinations(items) {
    const arrays = items.map((item) =>
      item.values.map((value) => ({
        optionName: item.name,
        name: value.name,
      })),
    );

    const combinationsArray = cartesian(...arrays);

    const combinations = combinationsArray.map((combination) => ({
      optionValues: Array.isArray(combination) ? combination : [combination],
    }));

    return combinations;
  }

  const bundleVariantsOptions = generateCombinations(customBundleOptions);
  const bundleVariantsIds = cartesian(...bundleComponentVariants);

  const bundleVariants = [];
  bundleVariantsOptions.forEach(({ optionValues }, index) => {
    bundleVariants.push({
      optionValues: [...optionValues],
      metafields: [
        {
          namespace: "custom",
          key: "component_quantities",
          type: "list.number_integer",
          value: JSON.stringify(bundleComponentsQuantities),
        },
        {
          namespace: "custom",
          key: "component_reference",
          type: "list.variant_reference",
          value: JSON.stringify(bundleVariantsIds[index]),
        },
      ],
    });
  });

  // creating a bundle product
  // const createBundle = await admin.graphql(
  //   `#graphql
  //   mutation($productInput: ProductInput!) {
  //     productCreate(input: $productInput) {
  //       userErrors {
  //         field
  //         message
  //       }
  //       product {
  //         id
  //         variants(first: 20) {
  //           edges {
  //             node {
  //               id
  //             }
  //           }
  //         }
  //         metafields(first: 3) {
  //           edges {
  //             node {
  //               id
  //               namespace
  //               key
  //               value
  //             }
  //           }
  //         }
  //       }
  //     }
  //   }
  // `,
  //   {
  //     variables: {
  //       productInput: {
  //         status: "ACTIVE",
  //         title: bundleTitle,
  //         published: true,
  //         claimOwnership: {
  //           bundles: true,
  //         },
  //         productOptions: customBundleOptions || defaultBundleOptions,
  //         // metafields: [
  //         //   {
  //         //     namespace: "custom",
  //         //     key: "component_quantities",
  //         //     type: "list.number_integer",
  //         //     value: bundleComponentsQuantities,
  //         //   },
  //         //   {
  //         //     namespace: "custom",
  //         //     key: "component_reference",
  //         //     type: "list.variant_reference",
  //         //     value: bundleComponentsIDs,
  //         //   },
  //         // ],
  //       },
  //     },
  //   },
  // );

  // trying the productSet mutation to set everything at once

  const createBundle = await admin.graphql(
    `#graphql
  mutation createBundleProduct($productSet: ProductSetInput!, $synchronous: Boolean!) {
  productSet(synchronous: $synchronous, input: $productSet) {
    product {
      id
      title
      variants(first: 100) {
        nodes {
          id
        }
      }
    }
    userErrors {
      field
      message
    }
  }
}
`,
    {
      variables: {
        synchronous: true,
        productSet: {
          title: bundleTitle,
          productOptions: customBundleOptions || defaultBundleOptions,
          variants: bundleVariants || [],
        },
      },
    },
  );

  const createBundleJSON = await createBundle.json();
  const bundleProduct = createBundleJSON.data.productSet.product;
  const createdBundleVariants = bundleProduct.variants;

  return json({ createBundleJSON });
}

export default function NewBundle() {
  // state
  const [title, setTitle] = useState("");
  const [products, setProducts] = useState([]);
  const [errors, setErrors] = useState({});
  const [productOptions, setProductOptions] = useState();

  console.log("products", products);
  const submit = useSubmit();
  const actionData = useActionData();

  console.log(actionData);

  // state handlers
  const handleTitleChange = (newValue) => {
    setErrors({});
    setTitle(newValue);
  };
  const handleProductsChange = async () => {
    const picked = await window.shopify.resourcePicker({
      type: "product",
      multiple: true,
      selectionIds: products,
      filter: {
        // hidden: false,
        // archived: false,
        // draft: false,
        variants: false,
      },
    });

    if (!picked) {
      return;
    }

    const updatedProducts = picked.map((newProduct) => {
      const existingProduct = products.find(
        (product) => product.id === newProduct.id,
      );
      const product = existingProduct || newProduct;
      return {
        ...product,
        bundleQuantity: existingProduct ? existingProduct.bundleQuantity : 1,
      };
    });
    setErrors({});
    setProducts(updatedProducts);
  };
  const handleQuantityUpdate = (id, quantity) => {
    const updatedProducts = products.map((product) => {
      if (product.id === id) {
        return { ...product, bundleQuantity: quantity };
      }

      return product;
    });
    setProducts(updatedProducts);
  };
  const handleOptionUpdate = (productId, optionId, optionValue) => {
    setProducts((prevProducts) => {
      return prevProducts.map((product) => {
        if (product.id === productId) {
          return {
            ...product,
            options: product.options.map((option) => {
              if (option.id === optionId) {
                // Initialize disabledValues if it doesn't exist
                const updatedDisabledValues = option.disabledValues || [];

                if (updatedDisabledValues.includes(optionValue)) {
                  // If the value is already in disabledValues, enable it by removing it
                  return {
                    ...option,
                    disabledValues: updatedDisabledValues.filter(
                      (value) => value !== optionValue,
                    ),
                  };
                } else {
                  // If the value is not in disabledValues, disable it by adding it
                  return {
                    ...option,
                    disabledValues: [...updatedDisabledValues, optionValue],
                  };
                }
              }
              return option;
            }),
          };
        }
        return product;
      });
    });
  };
  const handleFormSubmit = useCallback(() => {
    const newErrors = {};
    if (title.length === 0) newErrors.title = "Title is required.";
    if (products.length === 0) newErrors.products = "Products cannot be empty.";

    if (Object.keys(newErrors).length > 0) {
      return setErrors(newErrors);
    }

    const updatedProducts = products.map((product) => {
      const { options, variants } = product;

      const updatedOptions = options.map((option) => {
        const selectedValues = option.values.filter(
          (value) => !option.disabledValues?.includes(value),
        );
        return {
          ...option,
          selectedValues,
        };
      });

      const updatedVariants = variants.map((variant) => {});

      return {
        ...product,
        options: updatedOptions,
      };
    });

    console.log("updated products", updatedProducts);

    const formData = new FormData();
    formData.set("title", title);
    formData.set("products", JSON.stringify(updatedProducts));
    submit(formData, { method: "POST" });
  }, [title, products]);

  // show primary action
  const showAction = products.length > 0 || title.length > 0;
  const saveAction = {
    content: "Save",
    onAction: handleFormSubmit,
  };

  const discardAction = {
    content: "Discard",
    onAction: () => {
      setTitle("");
      setProducts([]);
      setErrors({});
    },
  };

  return (
    <Page
      title="Create bundle"
      compactTitle
      backAction={{ url: "/app" }}
      primaryAction={showAction ? saveAction : undefined}
      secondaryActions={showAction ? [discardAction] : undefined}
    >
      <BlockStack gap="500">
        <Layout>
          <Layout.Section>
            <Form onSubmit={handleFormSubmit}>
              <BlockStack gap={400}>
                <Card>
                  <BlockStack gap={200}>
                    <TextField
                      label="Title"
                      value={title}
                      onChange={handleTitleChange}
                      autoComplete="off"
                      placeholder="T-Shirt Bundle"
                    />
                    <InlineError message={errors.title} />
                  </BlockStack>
                </Card>
                <Card>
                  {products?.length > 0 ? (
                    <BlockStack gap={200}>
                      <InlineStack
                        blockAlign="center"
                        align="space-between"
                        wrap={false}
                      >
                        <Text>Products</Text>
                        <Button variant="plain" onClick={handleProductsChange}>
                          Add Products
                        </Button>
                      </InlineStack>
                      <ProductList
                        products={products}
                        handleQuantityUpdate={handleQuantityUpdate}
                        handleOptionUpdate={handleOptionUpdate}
                      />
                    </BlockStack>
                  ) : (
                    <BlockStack gap={200}>
                      <EmptyState
                        image={emptyState}
                        action={{
                          content: "Select products",
                          onAction: handleProductsChange,
                        }}
                      >
                        <p>Select the products you want to bundle.</p>
                      </EmptyState>
                      <InlineError message={errors.products} />
                    </BlockStack>
                  )}
                </Card>
              </BlockStack>
            </Form>
          </Layout.Section>
        </Layout>
      </BlockStack>
    </Page>
  );
}

function ProductList({ products, handleQuantityUpdate, handleOptionUpdate }) {
  return (
    <>
      {products.map((product) => (
        <ProductListRow
          key={product.id}
          product={product}
          handleQuantityUpdate={handleQuantityUpdate}
          handleOptionUpdate={handleOptionUpdate}
        />
      ))}
    </>
  );
}

function ProductListRow({ product, handleQuantityUpdate, handleOptionUpdate }) {
  const [quantity, setQuantity] = useState(product.bundleQuantity);
  const handleQuantity = useCallback((value) => {
    const newQuantity = value;
    setQuantity(newQuantity);
    handleQuantityUpdate(product.id, newQuantity);
  });
  const handleOption = useCallback((id, value) => {
    handleOptionUpdate(product.id, id, value);
  });

  const optionsArr = product.options;

  return (
    <InlineStack>
      <Box
        padding={400}
        borderColor="border"
        borderStyle="solid"
        borderWidth="0165"
        borderRadius="200"
        width="100%"
      >
        <BlockStack gap={300}>
          <InlineStack align="space-between">
            <InlineStack blockAlign="center" wrap={false} gap={300}>
              <Thumbnail source={product.images[0]?.originalSrc || ImageIcon} />
              <Text>{product.title}</Text>
            </InlineStack>
            <InlineStack blockAlign="center" wrap={false} gap={300}>
              <TextField
                type="integer"
                min={1}
                value={quantity}
                onChange={handleQuantity}
              />
            </InlineStack>
          </InlineStack>
          <BlockStack gap={200}>
            {optionsArr.map(({ id, values, name, disabledValues }) => {
              {
                return values.length > 1 ? (
                  <BlockStack gap={100} key={id}>
                    <Text>{name}</Text>
                    <InlineStack gap={200}>
                      {values.map((value, index, array) => {
                        const isDisabled = disabledValues?.includes(value);
                        const disableHandler =
                          disabledValues?.length + 1 === array.length &&
                          !disabledValues?.includes(value);

                        return (
                          <Button
                            onClick={() =>
                              !disableHandler && handleOption(id, value)
                            }
                            icon={isDisabled ? undefined : CheckIcon}
                            key={value}
                            variant={isDisabled ? "secondary" : "primary"}
                          >
                            {value}
                          </Button>
                        );
                      })}
                    </InlineStack>
                  </BlockStack>
                ) : null;
              }
            })}
          </BlockStack>
        </BlockStack>
      </Box>
    </InlineStack>
  );
}
