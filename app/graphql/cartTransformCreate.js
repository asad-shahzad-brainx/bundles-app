const cartTransformCreate = (functionId) => `
    mutation {
        cartTransformCreate(
        functionId: "${functionId}",
        blockOnFailure: false
        ) {
        cartTransform {
            id
            functionId
        }
        userErrors {
            field
            message
        }
        }
    }
`;

export default cartTransformCreate;
