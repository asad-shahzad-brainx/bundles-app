const createFetchBundleProductQuery = (productId) => `
  query {
    product(id: "gid://shopify/Product/${productId}") {
        id
        title
        bundle: metafield(namespace: "$app:bundle", key: "bundle-configuration") {
          id
          value
        }
        bundleType: metafield(namespace: "$app:bundleType", key: "bundleType-configuration") {
          id
          value
        }
    }
  }
`;

export default createFetchBundleProductQuery;
