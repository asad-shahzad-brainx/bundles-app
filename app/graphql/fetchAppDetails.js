const fetchAppDetails = `
    query {
        appByKey(apiKey: "${process.env.SHOPIFY_API_KEY}") {
            id
            handle
        }
    }
`;

export default fetchAppDetails;
