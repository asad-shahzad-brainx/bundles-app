import { useEffect, useState, useCallback } from "react";
import {
  useBreakpoints,
  IndexTable,
  Thumbnail,
  Text,
  Badge,
  UnstyledLink,
} from "@shopify/polaris";
import {NoteIcon} from '@shopify/polaris-icons';

import styles from "../../app/routes/_index/table.module.css";

export default function ProductList({
  products,
  hasPreviousPage,
  hasNextPage,
  startCursor,
  endCursor,
  handlePagination,
}) {

  const capitalizeFirstLetter = (string) => {
    return string.charAt(0).toUpperCase() + string.slice(1).toLowerCase();
  };

  const Products = products?.map((product) => {
    const productId = product?.node?.id?.split("/").pop();
    let bundleType = product?.node?.bundleType?.value;
    if(bundleType) {
      let jsonBundleType = JSON.parse(bundleType)
      bundleType = capitalizeFirstLetter(jsonBundleType?.bundleType)
    }
    return {
      id: productId,
      bundleType,
      url: `/app/bundles/${productId}`,
      title: product?.node?.title,
      status: product?.node?.status,
      media: product?.node?.featuredMedia?.preview?.image?.url,
      priceRange: `${product?.node?.priceRangeV2?.minVariantPrice?.currencyCode} ${product?.node?.priceRangeV2?.minVariantPrice?.amount} - ${product?.node?.priceRangeV2?.maxVariantPrice?.currencyCode} ${product?.node?.priceRangeV2?.maxVariantPrice?.amount}`
    };
  });

  const resourceName = {
    singular: "Bundle",
    plural: "Bundles",
  };

  const rowMarkup = Products?.map(
    (
      {
        id,
        bundleType,
        url,
        title,
        status,
        media,
        priceRange,
      },
      index,
    ) => (
      <IndexTable.Row
        id={id}
        key={id}
        position={index}
      >
        <IndexTable.Cell>
          {
            media ? (
              <Thumbnail source={media}/>
            ) : (
              <Thumbnail source={NoteIcon} />
            )
          }
        </IndexTable.Cell>
        <IndexTable.Cell>
          <UnstyledLink
            data-primary-link="true"
            url={url}
            accessibilitylabel={title}
            className={styles.link}
          >
            {title}
          </UnstyledLink>
        </IndexTable.Cell>
        <IndexTable.Cell>
          {status.toLowerCase() == "active" ? (
            <Badge tone="success">{capitalizeFirstLetter(status)}</Badge>
          ) : (
            <Badge tone="info">{capitalizeFirstLetter(status)}</Badge>
          )}
        </IndexTable.Cell>
        <IndexTable.Cell>
          <Text variant="bodyMd" as="span">
            {bundleType}
          </Text> 
        </IndexTable.Cell>
        <IndexTable.Cell>
          <Text variant="bodyMd" as="span" alignment="end" numeric>
            {priceRange}
          </Text>
        </IndexTable.Cell>
      </IndexTable.Row>
    ),
  );

  return (
    <>
      <IndexTable
        condensed={useBreakpoints().smDown}
        resourceName={resourceName}
        itemCount={Products?.length || 0}
        selectable={false}
        headings={[
          {
            id: "media",
            hidden: true,
            title: (
              <Text as="span" alignment="start">
                Featured Image
              </Text>
            ),
          },
          {
            id: "title",
            hidden: false,
            title: (
              <Text as="span" alignment="start">
                Title
              </Text>
            ),
          },
          { title: "Status" },
          { title: "Type" },
          {
            id: "price",
            hidden: false,
            title: (
              <Text as="span" alignment="end">
                Price
              </Text>
            ),
          },
        ]}
        pagination={{
          hasNext: hasNextPage,
          hasPrevious: hasPreviousPage,
          onNext: () => handlePagination("", endCursor),
          onPrevious: () => handlePagination(startCursor, "")
        }}
      >
        {rowMarkup}
      </IndexTable>
    </>
  );
}
