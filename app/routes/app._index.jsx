import { useEffect, useState } from "react";
import { json } from "@remix-run/node";
import {
  useActionData,
  useLoaderData,
} from "@remix-run/react";
import { Page, Layout, BlockStack, Card, EmptyState } from "@shopify/polaris";
import emptyState from "../assets/emptyState/app.svg";
import { useNavigate } from "@remix-run/react";
import { authenticate } from "../shopify.server";
import fetchAppDetails from "../graphql/fetchAppDetails";
import createFetchBundleProductsQuery from "../graphql/fetchBundleProducts";
import createFetchPaginatedBundleProductsQuery from "../graphql/fetchPaginationProducts";
import ProductTable from "../components/productTable";

export const loader = async ({ request }) => {
  const { admin, session } = await authenticate.admin(request);

  const AppDetailsResponse = await admin.graphql(fetchAppDetails);
  const AppDetailsResponseJson = await AppDetailsResponse.json();
  const AppId = AppDetailsResponseJson.data.appByKey.id.split("/").pop();

  // Generate the query dynamically using AppId
  const fetchBundleProductsQuery = createFetchBundleProductsQuery(AppId);

  const productsResponse = await admin.graphql(fetchBundleProductsQuery);
  const productsJson = await productsResponse.json();
  const pageInfo = productsJson.data.products.pageInfo;
  const ProductSets = productsJson.data.products.edges;

  return json({
    pageInfo,
    ProductSets,
  });
};

export async function action({ request }) {
  try {
    const { admin } = await authenticate.admin(request);
    const formData = Object.fromEntries(await request.formData());

    const fetchBundleProductsQuery = createFetchPaginatedBundleProductsQuery();    
    const productsResponse = await admin.graphql(fetchBundleProductsQuery,
      {
        variables: {
          first: formData?.before ? null : 50,
          last: formData?.before ? 50 : null,
          before: formData?.before || null,
          after: formData?.after || null
        }
      }
    );

    const productsJson = await productsResponse.json();
    const pageInfo = productsJson.data.products.pageInfo;
    const ProductSets = productsJson.data.products.edges;

    return json({
      pageInfo,
      ProductSets,
    });
    
  } catch (error) {
    console.error('Error occurred:', error);
    // Handle error appropriately
    return json({ error: error }, { status: 500 });
  }
}

export default function Index() {
  const navigate = useNavigate();
  const { pageInfo, ProductSets } = useLoaderData();

  const [ products, setProducts] = useState(ProductSets);
  const [ loading, setLoading] = useState(false);
  const [ emptyProductSets, setEmptyProductSets] = useState(false);
  const [ hasPreviousPage, setHasPreviousPage] = useState(pageInfo?.hasPreviousPage);
  const [ hasNextPage, setHasNextPage] = useState(pageInfo?.hasNextPage);
  const [ startCursor, setStartCursor] = useState(pageInfo?.startCursor);
  const [ endCursor, setEndCursor] = useState(pageInfo?.endCursor);

  const actionData = useActionData();

  useEffect(() => {

    if(!actionData) return;
    setLoading(false)

    const paginatedProductSets = actionData?.ProductSets;
    const pageInfo = actionData?.pageInfo;

    if(pageInfo){
      setHasPreviousPage(pageInfo?.hasPreviousPage);
      setHasNextPage(pageInfo?.hasNextPage);
      setStartCursor(pageInfo?.startCursor);
      setEndCursor(pageInfo?.endCursor);
    }

    setProducts(paginatedProductSets)
    if(paginatedProductSets){
      if(paginatedProductSets?.length > 0){
        setEmptyProductSets(false)
      } else {
        setEmptyProductSets(true)
      }
    } 

  }, [actionData]);

  return (
    <Page
      title="Easy Bundles"
      compactTitle
      primaryAction={{
        content: "Create bundle",
        onAction: () => navigate("bundles/new"),
      }}
      secondaryActions={[
        {
          content: "View in product list",
          onAction: () => window.open(`shopify://admin/products?bundles=true&tag=bundle&selectedView=all`, '_self'),
        },
      ]}
    >
      {products?.length > 0 || emptyProductSets ? (
        <ProductTable
          products={products}
          setLoading={setLoading} 
          loading={loading}
          hasPreviousPage={hasPreviousPage}
          hasNextPage={hasNextPage}
          startCursor={startCursor}
          endCursor={endCursor}
        />
      ) : (
        <BlockStack gap="500">
        <Layout>
          <Layout.Section>
            <Card>
              <EmptyState
                heading="Create a bundle to get started"
                action={{
                  content: "Create bundle",
                  onAction: () => navigate("bundles/new"),
                }}
                image={emptyState}
              >
                <p>
                  Group products and sell them as a bundle to offer more value
                  to customers.
                </p>
              </EmptyState>
            </Card>
          </Layout.Section>
        </Layout>
        </BlockStack>
      )}
    </Page>
  );
}
