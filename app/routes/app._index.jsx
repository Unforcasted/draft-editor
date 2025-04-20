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

  const response = await admin.graphql(
    `#graphql
    query {
      draftOrders(first: 10) {
        edges {
          node {
            id
            name
            createdAt
            status
            invoiceUrl
          }
        }
      }
    }`
  );

  const data = await response.json();

  const draftOrders = data.data.draftOrders.edges.map(edge => edge.node);

  return json({ draftOrders });
};

export default function DraftOrdersPage() {
  const { draftOrders } = useLoaderData();

  const rows = draftOrders.map(order => [
    order.name ? (
        <Link url={`/app/draft?id=${encodeURIComponent(order.id.replace('gid://shopify/DraftOrder/', ''))}`}>{order.name}</Link>
    ) : ("#"),
    
    order.status,
    new Date(order.createdAt).toLocaleDateString(),
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
        </BlockStack>
      </Card>
    </Page>
  );
}
