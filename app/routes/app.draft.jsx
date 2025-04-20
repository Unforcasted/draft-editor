import { json } from "@remix-run/node";
import { useLoaderData, useFetcher } from "@remix-run/react";
import {
  Page,
  Card,
  TextField,
  Text,
  BlockStack,
  Button,
  Divider,
  InlineStack,
  Label,
} from "@shopify/polaris";
import { DeleteIcon } from "@shopify/polaris-icons";
import { authenticate } from "../shopify.server";
import { useState } from "react";
import {useAppBridge} from '@shopify/app-bridge-react';

export const loader = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  const url = new URL(request.url);
  const idParam = url.searchParams.get("id");

  if (!idParam) {
    throw new Response("Missing draft order ID", { status: 400 });
  }

  const gid = `gid://shopify/DraftOrder/${idParam}`;

  const response = await admin.graphql(
    `#graphql
    query getDraftOrder($id: ID!) {
      draftOrder(id: $id) {
        id
        name
        invoiceUrl
        createdAt
        status
        lineItems(first: 10) {
          edges {
            node {
              id
              title
              quantity
              originalUnitPriceWithCurrency {
                amount
                currencyCode
              }
              customAttributes {
                key
                value
              }
            }
          }
        }
      }
    }`,
    {
      variables: { id: gid },
    }
  );

  const data = await response.json();
  return json(data.data.draftOrder);
};

export const action = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  const formData = await request.formData();

  const rawId = formData.get("orderId");
  const gid = rawId.startsWith("gid://") ? rawId : `gid://shopify/DraftOrder/${rawId}`;

  const lineItems = JSON.parse(formData.get("lineItems"));

  const response = await admin.graphql(
    `#graphql
    mutation draftOrderUpdate($id: ID!, $input: DraftOrderInput!) {
      draftOrderUpdate(id: $id, input: $input) {
        draftOrder {
          id
        }
        userErrors {
          field
          message
        }
      }
    }`,
    {
      variables: {
        id: gid,
        input: {
          lineItems: lineItems.map((li) => ({
            id: li.id,
            title: li.title,
            quantity: li.quantity,
            requiresShipping: true,
            originalUnitPriceWithCurrency: {
              amount: li.originalUnitPriceWithCurrency.amount,
              currencyCode: li.originalUnitPriceWithCurrency.currencyCode
            },
            customAttributes: li.customAttributes,
          })),
        },
      },
    }
  );

  const data = await response.json();
  console.log("Update result:", data.data.draftOrderUpdate.draftOrder);

  return null;
};


export default function DraftOrderEditor() {
  const order = useLoaderData();
  const fetcher = useFetcher();
  const shopify = useAppBridge();

  const [items, setItems] = useState(() =>
    order.lineItems.edges.map(({ node }) => ({
      id: node.id,
      title: node.title,
      quantity: node.quantity,
      price: node?.originalUnitPriceWithCurrency?.amount || 0,
      currency: node?.originalUnitPriceWithCurrency?.currencyCode || 'PLN',
      customAttributes: [...(node.customAttributes || [])],
    }))
  );

  const handlePropertyChange = (itemIndex, propIndex, field, value) => {
    setItems((prev) => {
      const updated = [...prev];
      updated[itemIndex].customAttributes[propIndex][field] = value;
      return updated;
    });
  };

  const handleAddProperty = (itemIndex) => {
    setItems((prev) => {
      const updated = [...prev];
      const item = { ...updated[itemIndex] };
      item.customAttributes = [...item.customAttributes, { key: "", value: "" }];
      updated[itemIndex] = item;
      return updated;
    });
  };

  const handleAddLineItem = () => {
    setItems((prev) => [
      ...prev,
      {
        id: `new-${Date.now()}`, // Temporary unique ID
        title: "Niestandardowy wydruk 3D",
        quantity: 1,
        price: 0,
        currency: "PLN",
        isEditingTitle: true,
        customAttributes: [],
      },
    ]);
  };

  const toggleTitleEdit = (itemIndex, value) => {
    setItems((prev) => {
      const updated = [...prev];
      updated[itemIndex].isEditingTitle = value;
      return updated;
    });
  };

  const handleRemoveProperty = (itemIndex, propIndex) => {
    setItems((prev) => {
      const updated = [...prev];
      updated[itemIndex].customAttributes.splice(propIndex, 1);
      return updated;
    });
  };

  const handleEditTitle = (itemIndex, newTitle) => {
    setItems((prev) => {
      const updated = [...prev];
      updated[itemIndex].title = newTitle;
      return updated;
    });
  };
  

  const handleSave = () => {
    fetcher.submit(
      {
        orderId: order.id,
        lineItems: JSON.stringify(items.map((item) => ({
          title: item.title,
          quantity: item.quantity,
          originalUnitPriceWithCurrency: {
            amount: parseFloat(item.price),
            currencyCode: item.currency
          },
          customAttributes: item.customAttributes.filter((a) => a.key && a.value),
        }))),
      },
      { method: "POST" }
    );
    
    shopify.toast.show("✅ Order saved!");
  };

  return (
    <Page title={`Edit ${order.name}`}>
      <Card>
        <BlockStack gap="500">
          <Text variant="headingMd" as="h2">
            Line Items
          </Text>

          {items.map((item, itemIndex) => (
            <Card key={item.id} padding="400">
              <InlineStack align="start" gap="400">
                {/* Thumbnail (placeholder box for now) */}
                <div style={{ width: 64, height: 64, background: "#eee", borderRadius: 4 }} />

                <BlockStack gap="300" width="100%">
                  {/* Top row: title + price + quantity + remove */}
                  <InlineStack gap="300" align="center" wrap={false}>
                    {item.isEditingTitle ? (
                      <TextField
                        autoFocus
                        value={item.title}
                        onChange={(val) => handleEditTitle(itemIndex, val)}
                        onBlur={() => toggleTitleEdit(itemIndex, false)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") toggleTitleEdit(itemIndex, false);
                        }}
                      />
                    ) : (
                      <InlineStack gap="100" align="center">
                        <Text variant="bodyMd" fontWeight="medium">
                          {item.title}
                        </Text>
                        <Button
                          variant="plain"
                          onClick={() => toggleTitleEdit(itemIndex, true)}
                        >
                          ✏️
                        </Button>
                      </InlineStack>
                    )}

                    <Label>Price</Label>
                    <TextField
                      label="Price"
                      labelHidden
                      type="number"
                      value={String(item.price || "")}
                      prefix="PLN"
                      onChange={(val) => {
                        const price = parseFloat(val || "0");
                        setItems((prev) => {
                          const updated = [...prev];
                          updated[itemIndex].price = price;
                          return updated;
                        });
                      }}
                    />

                    <Label>Quantity</Label>
                    <TextField
                      label="Qty"
                      labelHidden
                      type="number"
                      min={1}
                      value={String(item.quantity)}
                      onChange={(val) => {
                        const quantity = parseInt(val || "1");
                        setItems((prev) => {
                          const updated = [...prev];
                          updated[itemIndex].quantity = quantity;
                          return updated;
                        });
                      }}
                    />
                    <InlineStack align="end">
                      <Button
                        icon={DeleteIcon}
                        tone="critical"
                        onClick={() => {
                          setItems((prev) => prev.filter((_, i) => i !== itemIndex));
                        }}
                      />
                    </InlineStack>
                  
                  </InlineStack>

                  {/* Properties */}
                  {item.customAttributes.map((attr, propIndex) => (
                    <InlineStack key={propIndex} gap="300">
                      <TextField
                        label="Name"
                        labelHidden
                        value={attr.key}
                        onChange={(val) =>
                          handlePropertyChange(itemIndex, propIndex, "key", val)
                        }
                        autoComplete="off"
                      />
                      <TextField
                        label="Value"
                        labelHidden
                        value={attr.value}
                        onChange={(val) =>
                          handlePropertyChange(itemIndex, propIndex, "value", val)
                        }
                        autoComplete="off"
                      />
                      <Button
                        icon={DeleteIcon}
                        tone="critical"
                        onClick={() => handleRemoveProperty(itemIndex, propIndex)}
                      />
                    </InlineStack>
                  ))}

                  {/* Add new prop */}
                </BlockStack>
                <Button onClick={() => handleAddProperty(itemIndex)}>
                  + Add Property
                </Button>
              </InlineStack>
              
            </Card>
          ))}
          <Button onClick={handleAddLineItem} variant="secondary">
            ➕ Add New Line Item
          </Button>

          <Divider />
          <Button variant="primary" onClick={handleSave}>
            💾 Save All Changes
          </Button>
        </BlockStack>
      </Card>
    </Page>
  );
}