const cartTrasformFunction = `
    query {
        shopifyFunctions(first: 1, apiType: "cart_transform") {
          nodes {
            id
          }
        }
      }
`;

export default cartTrasformFunction;
