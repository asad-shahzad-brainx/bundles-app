import { Page, Layout, BlockStack, Card, EmptyState } from "@shopify/polaris";
import emptyState from "../assets/emptyState/app.svg";
import { useNavigate } from "@remix-run/react";

export default function Index() {
  const navigate = useNavigate();

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
          content: "View on your store",
          onAction: () => alert("View on your store action"),
        },
      ]}
    >
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
    </Page>
  );
}
