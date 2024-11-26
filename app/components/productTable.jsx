import { useCallback } from "react";
import { useSubmit } from "@remix-run/react";
import {
  Card
} from "@shopify/polaris";

import ProductList from "./productList";

export default function ProductTable({
  products,
  setLoading,
  loading,
  hasPreviousPage,
  hasNextPage,
  startCursor,
  endCursor,
}) {

  const submit = useSubmit();
  const handlePagination = useCallback(
    (before, after) => {
      const data = {
        before,
        after,
      };

      setLoading(true);
      submit(data, { method: "post" });
    },
    [
      submit,
      setLoading,
    ],
  );

  return (
    <Card>
      <ProductList
        products={products}
        hasPreviousPage={hasPreviousPage}
        hasNextPage={hasNextPage}
        startCursor={startCursor}
        endCursor={endCursor}
        handlePagination={handlePagination}
      />
    </Card>
  );
}
