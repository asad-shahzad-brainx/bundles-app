const createFetchPaginatedBundleProductsQuery = () => `
  query Products(
    $first: Int
    $last: Int
    $before: String
    $after: String
  )  {
    products(first: $first last: $last before: $before after: $after query: "status:ACTIVE,DRAFT,ARCHIVED bundles:true has_variant_with_components:true tag:bundle", sortKey: ID, reverse: true) {
      pageInfo {
        hasNextPage
        hasPreviousPage
        startCursor
        endCursor
      }
      edges {
        node {
          id
          status
          title
          featuredMedia {
            preview {
              image {
                url
              }
            }
          }
          priceRangeV2 {
            maxVariantPrice {
              amount
              currencyCode
            }
            minVariantPrice {
              amount
              currencyCode
            }
          }
          bundleType: metafield(namespace: "$app:bundleType", key: "bundleType-configuration") {
            id
            value
          }
        }
      }
    }
  }
`;

export default createFetchPaginatedBundleProductsQuery;
