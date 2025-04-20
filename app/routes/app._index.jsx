import { json } from "@remix-run/node";
import { useLoaderData, Link as RemixLink } from "@remix-run/react";
import {
  Page,
  Card,
  DataTable,
  Text,
  BlockStack,
  Link,
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  const url = new URL(request.url);
  const after = url.searchParams.get("after") || null;

  const query = `#graphql
    query draftOrders($after: String) {
      draftOrders(first: 10, after: $after, reverse: true, sortKey: ID) {
        edges {
          cursor
          node {
            id
            name
            createdAt
            status
            invoiceUrl
          }
        }
        pageInfo {
          hasNextPage
        }
      }
    }`;

  const response = await admin.graphql(query, {
    variables: { after },
  });

  const data = await response.json();

  const edges = data.data.draftOrders.edges;
  const draftOrders = edges.map(edge => edge.node);
  const lastCursor = edges.length > 0 ? edges[edges.length - 1].cursor : null;
  const hasNextPage = data.data.draftOrders.pageInfo.hasNextPage;

  return json({ draftOrders, lastCursor, hasNextPage });
};

export default function DraftOrdersPage() {
  const { draftOrders, lastCursor, hasNextPage } = useLoaderData();

  const rows = draftOrders.map(order => [
    order.name ? (
      <Link
        url={`/app/draft?id=${encodeURIComponent(
          order.id.replace("gid://shopify/DraftOrder/", "")
        )}`}
      >
        {order.name}
      </Link>
    ) : (
      "#"
    ),
    order.status,
    new Date(order.createdAt).toLocaleDateString(),
    order.invoiceUrl ? (
      <Link url={order.invoiceUrl} target="_blank">
        Invoice
      </Link>
    ) : (
      "-"
    ),
  ]);

  return (
    <Page title="Draft Orders">
      <Card>
        <BlockStack gap="300">
          <Text variant="headingMd" as="h2">
            Draft Orders
          </Text>
          <DataTable
            columnContentTypes={["text", "text", "text", "text"]}
            headings={["Order", "Status", "Created At", "Invoice"]}
            rows={rows}
          />
          {hasNextPage && (
            <RemixLink
              to={`?after=${encodeURIComponent(lastCursor)}`}
              style={{ alignSelf: "flex-start", marginTop: "16px" }}
            >
              <Text as="span" variant="bodyMd">
                ➕ Load more
              </Text>
            </RemixLink>
          )}
        </BlockStack>
      </Card>
    </Page>
  );
}
